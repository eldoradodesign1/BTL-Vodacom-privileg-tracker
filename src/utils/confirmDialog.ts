/**
 * Confirmation intégrée à l'application (remplace window.confirm).
 * Retourne une promesse : true si l'utilisateur confirme, false sinon (Annuler, Échap ou toucher du fond).
 * Le focus démarre sur « Annuler » : une action destructive ne doit jamais se valider par réflexe.
 */
export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const { message, title = 'Confirmer', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', tone = 'default' } = options;

  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);

    const sheet = document.createElement('div');
    sheet.className = 'confirm-sheet';

    const heading = document.createElement('h2');
    heading.className = 'confirm-title';
    heading.textContent = title;

    const body = document.createElement('p');
    body.className = 'confirm-message';
    body.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'confirm-button confirm-button--cancel';
    cancel.textContent = cancelLabel;

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = `confirm-button confirm-button--${tone}`;
    confirm.textContent = confirmLabel;

    actions.append(cancel, confirm);
    sheet.append(heading, body, actions);
    overlay.append(sheet);

    const finish = (value: boolean) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.add('confirm-overlay--leaving');
      window.setTimeout(() => {
        overlay.remove();
        previouslyFocused?.focus?.();
        resolve(value);
      }, 140);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); finish(false); }
      if (event.key === 'Tab') {
        const focusables = [cancel, confirm];
        const index = focusables.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        focusables[(index + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus();
      }
    };

    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); });
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    cancel.focus();
  });
}
