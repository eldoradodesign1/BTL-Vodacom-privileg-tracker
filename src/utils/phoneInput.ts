// Comportement commun des champs de saisie de téléphone (marqués data-phone-input) :
// - +243 puis 9 chiffres, sinon 10 chiffres au total ; trop long ou incomplet = alerte rouge ;
// - au focus d'un champ vide, si le presse-papier est déjà autorisé et contient un numéro,
//   il est collé directement au format normalisé (0XXXXXXXXX).

const SELECTOR = 'input[data-phone-input]';

type PhoneState = 'ok' | 'error' | '';

const isInternational = (raw: string) => /^\+?\s*243/.test(raw.trim());

export const phoneState = (value: string, typing: boolean): PhoneState => {
  const raw = value.trim();
  if (!raw) return '';
  if (/[^\d\s+\-.()]/.test(raw)) return 'error';
  const digits = raw.replace(/\D/g, '');
  const expected = isInternational(raw) ? 12 : 10;
  if (digits.length === expected) return 'ok';
  if (digits.length > expected || !typing) return 'error';
  return '';
};

/** Numéro RDC reconnu dans un texte libre (espaces, tirets, +243, 08…, 09…), rendu en 0XXXXXXXXX. */
export const normalizePhone = (text: string): string | null => {
  const raw = text.trim();
  if (!raw || raw.length > 24 || /[^\d\s+\-.()]/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  if (/^243[89]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^0[89]\d{8}$/.test(digits)) return digits;
  if (/^[89]\d{8}$/.test(digits)) return `0${digits}`;
  return null;
};

const paint = (input: HTMLInputElement, typing: boolean) => {
  const state = phoneState(input.value, typing);
  if (state) input.dataset.phoneState = state;
  else delete input.dataset.phoneState;
  if (state === 'error') input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
};

// Passe par le setter natif pour que React voie la nouvelle valeur.
const setReactValue = (input: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const clipboardGranted = async () => {
  try {
    const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
    return status.state === 'granted';
  } catch {
    return false;
  }
};

const pasteFromClipboard = async (input: HTMLInputElement) => {
  if (input.value.trim() || input.disabled || input.readOnly || !navigator.clipboard?.readText) return;
  if (!(await clipboardGranted())) return;
  try {
    const phone = normalizePhone(await navigator.clipboard.readText());
    if (phone && !input.value.trim() && document.activeElement === input) setReactValue(input, phone);
  } catch {
    // Lecture refusée ou indisponible : rien à faire.
  }
};

const target = (event: Event) => {
  const element = event.target;
  return element instanceof HTMLInputElement && element.matches(SELECTOR) ? element : null;
};

export const installPhoneInputs = () => {
  document.addEventListener('input', (event) => { const input = target(event); if (input) paint(input, true); }, true);
  document.addEventListener('focusin', (event) => { const input = target(event); if (input) { paint(input, true); void pasteFromClipboard(input); } });
  document.addEventListener('focusout', (event) => { const input = target(event); if (input) paint(input, false); });
};
