/**
 * Rebind dialog. The profile is the modern default until the player
 * changes a row. Browser-reserved chords are refused.
 */
import { ACTIONS, formatChord, type Chord } from './input/actions.ts';
import type { KeyTracker } from './input/keymap.ts';

export function mountKeymapDialog(keys: KeyTracker, note: (text: string) => void): void {
  const dialog = document.getElementById('keymap');
  const list = document.getElementById('keymap-list');
  if (!(dialog instanceof HTMLDialogElement) || !list) return;
  const paint = () => {
    list.replaceChildren();
    const profile = keys.profile();
    let group = '';
    for (const action of ACTIONS) {
      if (action.group !== group) {
        group = action.group;
        const heading = document.createElement('h3');
        heading.textContent = group;
        list.append(heading);
      }
      const row = document.createElement('div');
      row.className = 'key-row';
      const label = document.createElement('span');
      label.textContent = action.label;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = formatChord(profile[action.id] ?? null);
      button.addEventListener('click', () => capture(action.id, button));
      row.append(label, button);
      list.append(row);
    }
  };
  const capture = (id: string, button: HTMLButtonElement) => {
    button.textContent = 'Press a key';
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener('keydown', onKey, true);
      if (event.code === 'Escape') {
        paint();
        return;
      }
      const next: Chord = {
        code: event.code,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
      };
      const result = keys.rebind(id, next);
      if (result.rejected) note('That key is reserved by the browser.');
      else if (result.swapped) note(`Swapped with ${result.swapped}.`);
      paint();
    };
    window.addEventListener('keydown', onKey, true);
  };
  document.getElementById('keys-open')?.addEventListener('click', () => {
    paint();
    dialog.showModal();
  });
  document.getElementById('keys-reset')?.addEventListener('click', () => {
    keys.reset();
    paint();
  });
  document.getElementById('keys-close')?.addEventListener('click', () => dialog.close());
}
