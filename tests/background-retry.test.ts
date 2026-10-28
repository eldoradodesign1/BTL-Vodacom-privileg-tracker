import test from 'node:test';
import assert from 'node:assert/strict';

// Environnement navigateur minimal : la file d'arrière-plan n'utilise que ces API.
const listeners = new Map<string, Set<() => void>>();
const target = {
  addEventListener: (type: string, fn: () => void) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type)!.add(fn); },
  removeEventListener: (type: string, fn: () => void) => { listeners.get(type)?.delete(fn); },
};
const store = new Map<string, string>();
Object.assign(globalThis, {
  window: { ...target, setTimeout, clearTimeout, dispatchEvent: () => true },
  document: { ...target, visibilityState: 'visible' },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } },
  CustomEvent: class { constructor(public type: string, public init?: unknown) {} },
});

const { isTransientError, runInBackground } = await import('../src/utils/backgroundOperations');

test('une coupure réseau est renvoyée, une règle métier refusée ne l’est pas', () => {
  assert.equal(isTransientError(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientError(new Error('Impossible d’enregistrer la transaction : TypeError: Load failed')), true);
  assert.equal(isTransientError(new Error('Ce POS a déjà été pris en charge aujourd’hui par un autre Brand Ambassador.')), false);
  assert.equal(isTransientError(new Error('Le quota par POS est limité à 5,00 $.')), false);
});

test('une saisie échouée sur coupure réseau est renvoyée avec la même clé', async () => {
  const keys: string[] = [];
  const result = await new Promise<string>((resolve, reject) => {
    runInBackground('Transaction', async ({ key, attempt }) => {
      keys.push(key);
      if (attempt === 1) throw new TypeError('Failed to fetch');
      return 'ok';
    }, { onSuccess: resolve, onError: reject });
    // Le retour du réseau relance immédiatement, sans attendre le délai.
    setTimeout(() => listeners.get('online')?.forEach((fn) => fn()), 50);
  });
  assert.equal(result, 'ok');
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test('une erreur métier remonte sans renvoi', async () => {
  let attempts = 0;
  const error = await new Promise<Error>((resolve) => {
    runInBackground('Demande de fonds', async () => { attempts += 1; throw new Error('Le montant de la demande de fonds est invalide.'); }, { onError: resolve });
  });
  assert.match(error.message, /invalide/);
  assert.equal(attempts, 1);
});
