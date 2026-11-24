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
    button.textContent = 'Press a key or mouse button';
    const finish = (next: Chord | null, rejectedNote: string) => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      if (!next) {
        paint();
        return;
      }
      const result = keys.rebind(id, next);
      if (result.rejected) note(rejectedNote);
      else if (result.swapped) note(`Swapped with ${result.swapped}.`);
      paint();
    };
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        finish(null, '');
        return;
      }
      finish(
        {
          code: event.code,
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
        'That key is reserved by the browser.',
      );
    };
    const onPointer = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      const plain = !event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey;
      if (event.button === 0 && plain) {
        note('Plain left-click stays the helm.');
        finish(null, '');
        return;
      }
      if (event.button === 2 && plain) {
        note('Right-click stays targeting.');
        finish(null, '');
        return;
      }
      const code = event.button === 1 ? 'MouseMiddle' : event.button === 0 ? 'MouseLeft' : 'MouseRight';
      finish(
        {
          code,
          ctrl: event.ctrlKey,
          shift: event.shiftKey,
          alt: event.altKey,
          meta: event.metaKey,
        },
        'That button stays on helm or targeting.',
      );
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
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
