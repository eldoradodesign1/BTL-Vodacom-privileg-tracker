import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, getUsers, purgeAndResetEverything, saveUsers } from '../src/utils/storage';
import type { User } from '../src/types';

// Comptes fictifs propres aux tests : aucune donnée réelle n'est embarquée dans l'application.
const fixtures: User[] = [
  { id: 'test-agent', phone: '0810000001', name: 'Agent Fictif', role: 'agent', password: 'secret-agent', permanentShopId: null },
  { id: 'test-sans-mdp', phone: '0810000002', name: 'Sans Mot De Passe', role: 'supervisor', permanentShopId: null },
];

test('aucun compte n\u2019est embarqué : la liste est vide après réinitialisation', () => {
  purgeAndResetEverything();
  assert.deepEqual(getUsers(), []);
});

test('authenticate accepte le mot de passe enregistré', () => {
  purgeAndResetEverything();
  saveUsers(fixtures);
  const result = authenticate('0810000001', 'secret-agent');
  assert.equal(result.success, true);
  assert.equal(result.user?.role, 'agent');
});

test('authenticate refuse un mauvais mot de passe', () => {
  purgeAndResetEverything();
  saveUsers(fixtures);
  assert.equal(authenticate('0810000001', 'mauvais').success, false);
});

test('authenticate refuse un compte sans mot de passe, même avec les anciennes valeurs par défaut', () => {
  purgeAndResetEverything();
  saveUsers(fixtures);
  assert.equal(authenticate('0810000002', 'test').success, false);
  assert.equal(authenticate('0810000002', 'password').success, false);
  assert.equal(authenticate('0810000002', '').success, false);
});
