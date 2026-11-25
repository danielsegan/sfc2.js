/**
 * Modern default keymap. Physical `KeyboardEvent.code` values, so a
 * non-US layout still hits the same keys. Labels are what the player
 * sees in the rebind dialog. See docs/ui/keymap.md.
 */

export interface Chord {
  readonly code: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly meta: boolean;
}

export interface ActionDef {
  readonly id: string;
  readonly label: string;
  readonly group: string;
  /** Held keys are sampled each frame. One-shot keys fire on keydown. */
  readonly hold?: boolean;
  /** Browser key-repeat may fire this one-shot again. */
  readonly repeat?: boolean;
  readonly binding: Chord | null;
}

export type Profile = Record<string, Chord | null>;

function chord(code: string, mods: Partial<Pick<Chord, 'ctrl' | 'shift' | 'alt' | 'meta'>> = {}): Chord {
  return { code, ctrl: mods.ctrl === true, shift: mods.shift === true, alt: mods.alt === true, meta: mods.meta === true };
}

export const ACTIONS: readonly ActionDef[] = [
  { id: 'helm.speedUp', label: 'Speed up', group: 'Helm', repeat: true, binding: chord('KeyW') },
  { id: 'helm.speedDown', label: 'Speed down', group: 'Helm', repeat: true, binding: chord('KeyS') },
  { id: 'helm.turnLeft', label: 'Turn left', group: 'Helm', hold: true, binding: chord('KeyA') },
  { id: 'helm.turnRight', label: 'Turn right', group: 'Helm', hold: true, binding: chord('KeyD') },
  { id: 'helm.stop', label: 'All stop', group: 'Helm', binding: chord('KeyX') },
  { id: 'helm.reverse', label: 'Reverse', group: 'Helm', binding: chord('KeyR') },
  { id: 'helm.erratic', label: 'Erratic maneuvers', group: 'Helm', binding: chord('KeyE') },
  { id: 'helm.hetPort', label: 'High-energy turn to port', group: 'Helm', binding: chord('KeyQ') },
  { id: 'helm.hetStarboard', label: 'High-energy turn to starboard', group: 'Helm', binding: chord('KeyF') },
  { id: 'weapons.group1', label: 'Fire group 1', group: 'Weapons', binding: chord('Digit1') },
  { id: 'weapons.group2', label: 'Fire group 2', group: 'Weapons', binding: chord('Digit2') },
  { id: 'weapons.group3', label: 'Fire group 3', group: 'Weapons', binding: chord('Digit3') },
  { id: 'weapons.group4', label: 'Fire group 4', group: 'Weapons', binding: chord('Digit4') },
  { id: 'weapons.group5', label: 'Fire group 5', group: 'Weapons', binding: chord('Digit5') },
  { id: 'weapons.group6', label: 'Fire group 6', group: 'Weapons', binding: chord('Digit6') },
  { id: 'weapons.fire', label: 'Fire selected group', group: 'Weapons', binding: chord('Space') },
  { id: 'weapons.selectAll', label: 'Select all weapons', group: 'Weapons', binding: null },
  { id: 'weapons.alphaStrike', label: 'Alpha strike', group: 'Weapons', binding: null },
  { id: 'weapons.overload', label: 'Toggle overload', group: 'Weapons', binding: chord('KeyO') },
  { id: 'weapons.proximity', label: 'Toggle proximity', group: 'Weapons', binding: null },
  { id: 'weapons.assign1', label: 'Assign selection to group 1', group: 'Weapons', binding: chord('Digit1', { ctrl: true }) },
  { id: 'weapons.assign2', label: 'Assign selection to group 2', group: 'Weapons', binding: chord('Digit2', { ctrl: true }) },
  { id: 'weapons.assign3', label: 'Assign selection to group 3', group: 'Weapons', binding: chord('Digit3', { ctrl: true }) },
  { id: 'weapons.assign4', label: 'Assign selection to group 4', group: 'Weapons', binding: chord('Digit4', { ctrl: true }) },
  { id: 'weapons.assign5', label: 'Assign selection to group 5', group: 'Weapons', binding: chord('Digit5', { ctrl: true }) },
  { id: 'weapons.assign6', label: 'Assign selection to group 6', group: 'Weapons', binding: chord('Digit6', { ctrl: true }) },
  { id: 'shields.facing0', label: 'Reinforce bow', group: 'Shields', binding: chord('Numpad8') },
  { id: 'shields.facing1', label: 'Reinforce forward starboard', group: 'Shields', binding: chord('Numpad9') },
  { id: 'shields.facing2', label: 'Reinforce aft starboard', group: 'Shields', binding: chord('Numpad3') },
  { id: 'shields.facing3', label: 'Reinforce stern', group: 'Shields', binding: chord('Numpad2') },
  { id: 'shields.facing4', label: 'Reinforce aft port', group: 'Shields', binding: chord('Numpad1') },
  { id: 'shields.facing5', label: 'Reinforce forward port', group: 'Shields', binding: chord('Numpad7') },
  { id: 'shields.clear0', label: 'Clear bow reinforcement', group: 'Shields', binding: chord('Numpad8', { shift: true }) },
  { id: 'shields.clear1', label: 'Clear forward starboard', group: 'Shields', binding: chord('Numpad9', { shift: true }) },
  { id: 'shields.clear2', label: 'Clear aft starboard', group: 'Shields', binding: chord('Numpad3', { shift: true }) },
  { id: 'shields.clear3', label: 'Clear stern reinforcement', group: 'Shields', binding: chord('Numpad2', { shift: true }) },
  { id: 'shields.clear4', label: 'Clear aft port', group: 'Shields', binding: chord('Numpad1', { shift: true }) },
  { id: 'shields.clear5', label: 'Clear forward port', group: 'Shields', binding: chord('Numpad7', { shift: true }) },
  { id: 'shields.general', label: 'Toggle general reinforcement', group: 'Shields', binding: chord('Numpad5') },
  { id: 'power.attack', label: 'Attack preset', group: 'Power', binding: chord('F1') },
  { id: 'power.balanced', label: 'Balanced preset', group: 'Power', binding: chord('F2') },
  { id: 'power.run', label: 'Run preset', group: 'Power', binding: chord('F3') },
  { id: 'power.defense', label: 'Defense preset', group: 'Power', binding: chord('F4') },
  { id: 'target.next', label: 'Next hostile', group: 'Target', binding: chord('Tab') },
  { id: 'target.prev', label: 'Previous hostile', group: 'Target', binding: chord('Tab', { shift: true }) },
  { id: 'target.nearest', label: 'Nearest hostile', group: 'Target', binding: chord('KeyT') },
  { id: 'target.friendly', label: 'Cycle friendlies', group: 'Target', binding: chord('KeyY') },
  { id: 'ops.tractor', label: 'Tractor', group: 'Ops', binding: chord('KeyG') },
  { id: 'ops.repel', label: 'Repel or release tractor', group: 'Ops', binding: chord('KeyG', { shift: true }) },
  { id: 'ops.board', label: 'Boarding party', group: 'Ops', binding: chord('KeyB') },
  { id: 'ops.hitAndRun', label: 'Hit and run', group: 'Ops', binding: chord('KeyB', { shift: true }) },
  { id: 'ops.cloak', label: 'Cloak', group: 'Ops', binding: chord('KeyC') },
  { id: 'craft.launch', label: 'Launch fighter', group: 'Craft', binding: chord('KeyL') },
  { id: 'craft.launchPf', label: 'Launch PF', group: 'Craft', binding: null },
  { id: 'craft.recall', label: 'Recall craft', group: 'Craft', binding: chord('KeyL', { shift: true }) },
  { id: 'craft.drone', label: 'Launch drone', group: 'Craft', binding: chord('KeyJ') },
  { id: 'craft.mine', label: 'Lay mine', group: 'Craft', binding: chord('KeyK') },
  { id: 'ew.shiftEcm', label: 'Shift EW toward ECM', group: 'EW', binding: chord('BracketLeft') },
  { id: 'ew.shiftEccm', label: 'Shift EW toward ECCM', group: 'EW', binding: chord('BracketRight') },
  { id: 'ew.totalDown', label: 'Lower EW power', group: 'EW', binding: chord('BracketLeft', { ctrl: true }) },
  { id: 'ew.totalUp', label: 'Raise EW power', group: 'EW', binding: chord('BracketRight', { ctrl: true }) },
  { id: 'view.camera', label: 'Cycle camera', group: 'View', binding: chord('KeyV') },
  { id: 'view.orbitLeft', label: 'Orbit camera left', group: 'View', hold: true, binding: chord('ArrowLeft', { alt: true }) },
  { id: 'view.orbitRight', label: 'Orbit camera right', group: 'View', hold: true, binding: chord('ArrowRight', { alt: true }) },
  { id: 'view.orbitMiddle', label: 'Orbit camera (middle-drag)', group: 'View', binding: chord('MouseMiddle') },
  { id: 'view.orbitAlt', label: 'Orbit camera (Alt+left-drag)', group: 'View', binding: chord('MouseLeft', { alt: true }) },
  { id: 'view.map', label: 'Toggle sensor map', group: 'View', binding: chord('KeyM') },
  { id: 'view.mapOrientation', label: 'Toggle map orientation', group: 'View', binding: chord('KeyH') },
  { id: 'view.reset', label: 'Reset camera', group: 'View', binding: chord('Home') },
  { id: 'view.pause', label: 'Pause', group: 'View', binding: chord('Escape') },
  { id: 'hud.toggleInterfaceBar', label: 'Toggle interface bar', group: 'View', binding: chord('Backquote') },
];

const RESERVED: readonly Chord[] = [
  chord('F5'),
  chord('F11'),
  chord('KeyW', { ctrl: true }),
  chord('KeyT', { ctrl: true }),
  chord('KeyN', { ctrl: true }),
  chord('KeyR', { ctrl: true }),
  chord('MouseLeft'),
  chord('MouseRight'),
];

export function defaultProfile(): Profile {
  const profile: Profile = {};
  for (const action of ACTIONS) profile[action.id] = action.binding;
  return profile;
}

export function actionDef(id: string): ActionDef | undefined {
  return ACTIONS.find((action) => action.id === id);
}

export function sameChord(a: Chord | null, b: Chord | null): boolean {
  if (a === null || b === null) return a === b;
  return a.code === b.code && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.meta === b.meta;
}

export function isReserved(chordValue: Chord): boolean {
  return RESERVED.some((reserved) => reserved.code === chordValue.code && reserved.ctrl === chordValue.ctrl && reserved.alt === chordValue.alt && reserved.meta === chordValue.meta);
}

export function chordFromEvent(event: { code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): Chord {
  return chord(event.code, { ctrl: event.ctrlKey, shift: event.shiftKey, alt: event.altKey, meta: event.metaKey });
}

export function formatChord(value: Chord | null): string {
  if (!value) return 'Unbound';
  const parts: string[] = [];
  if (value.ctrl) parts.push('Ctrl');
  if (value.alt) parts.push('Alt');
  if (value.shift) parts.push('Shift');
  if (value.meta) parts.push('Meta');
  parts.push(mouseLabel(value.code));
  return parts.join('+');
}

function mouseLabel(code: string): string {
  if (code === 'MouseLeft') return 'Left drag';
  if (code === 'MouseMiddle') return 'Middle drag';
  if (code === 'MouseRight') return 'Right drag';
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}

export interface BindResult {
  readonly profile: Profile;
  readonly swapped?: string;
  readonly rejected?: string;
}

/** Bind `id` to `next`. A key already in use swaps with this action. */
export function bindAction(profile: Profile, id: string, next: Chord | null): BindResult {
  if (!actionDef(id)) return { profile, rejected: 'unknown action' };
  if (next && isReserved(next)) return { profile, rejected: 'reserved' };
  const copy: Profile = { ...profile };
  let swapped: string | undefined;
  if (next) {
    for (const action of ACTIONS) {
      if (action.id !== id && sameChord(copy[action.id] ?? null, next)) {
        copy[action.id] = copy[id] ?? null;
        swapped = action.id;
        break;
      }
    }
  }
  copy[id] = next;
  return { profile: copy, swapped };
}

export function actionFor(profile: Profile, value: Chord): string | null {
  for (const action of ACTIONS) {
    if (sameChord(profile[action.id] ?? null, value)) return action.id;
  }
  return null;
}
