/**
 * Six-slot skirmish board. Each slot picks a side, an empire, a ship, and
 * whether the player or a captain drives it. Empty slots are not spawned.
 */
import { SKIRMISH_CLASSES, SKIRMISH_EMPIRES, classById, empireById } from '../../engine/duel/catalog.ts';

export const SKIRMISH_SLOTS = 6;

export type SlotChoice =
  | { readonly control: 'empty' }
  | {
      readonly control: 'you' | 'ai';
      readonly side: 0 | 1;
      readonly kind: 'synthetic';
      readonly empireId: string;
      readonly classId: string;
    }
  | {
      readonly control: 'you' | 'ai';
      readonly side: 0 | 1;
      readonly kind: 'shiplist';
      readonly candidateIndex: number;
    };

export interface ShiplistOption {
  readonly index: number;
  readonly empire: string;
  readonly label: string;
}

export interface SlotSnapshot {
  readonly control: string;
  readonly side: string;
  readonly empire: string;
  readonly ship: string;
}

interface Row {
  readonly control: HTMLSelectElement;
  readonly side: HTMLSelectElement;
  readonly empire: HTMLSelectElement;
  readonly ship: HTMLSelectElement;
}

let mode: 'synthetic' | 'shiplist' = 'synthetic';
let shiplist: readonly ShiplistOption[] = [];
const rows: Row[] = [];
let onBoardChange: (() => void) | null = null;

export function skirmishMode(): 'synthetic' | 'shiplist' {
  return mode;
}

export function snapshotSlots(): SlotSnapshot[] {
  return rows.map((row) => ({
    control: row.control.value,
    side: row.side.value,
    empire: row.empire.value,
    ship: row.ship.value,
  }));
}

/** True when the board is no longer the default two-ship duel. */
export function isDefaultDuelSetup(boardMode: 'synthetic' | 'shiplist', slots: readonly SlotSnapshot[]): boolean {
  if (slots.length < 2) return false;
  if (slots[0]?.control !== 'you' || slots[1]?.control !== 'ai') return false;
  for (let i = 2; i < slots.length; i++) {
    if (slots[i] && slots[i].control !== 'empty') return false;
  }
  if (boardMode === 'synthetic') {
    return (
      slots[0].empire === 'federation' &&
      slots[0].ship === 'cruiser' &&
      slots[1].empire === 'klingon' &&
      slots[1].ship === 'cruiser'
    );
  }
  return true;
}

/**
 * Decide how a newly arrived shiplist should land on the board.
 * A late catalog must not wipe slots 2–6 or switch away from a custom
 * synthetic fleet. `reset` is for an intentional 1v1 reload.
 */
export function resolveShiplistAssignments(
  previous: readonly SlotSnapshot[],
  previousMode: 'synthetic' | 'shiplist',
  options: readonly ShiplistOption[],
  player: number,
  opponent: number,
  reset: boolean,
): { mode: 'synthetic' | 'shiplist'; slots: SlotSnapshot[]; catalogOnly: boolean } {
  if (!reset && previousMode === 'synthetic' && !isDefaultDuelSetup(previousMode, previous)) {
    return { mode: 'synthetic', slots: [...previous], catalogOnly: true };
  }
  if (!reset && previousMode === 'shiplist' && previous.length > 0) {
    const slots: SlotSnapshot[] = previous.map((slot) => {
      if (slot.control === 'empty') return slot;
      const index = Number(slot.ship);
      const option = options.find((item) => item.index === index);
      if (!option) return { control: 'empty', side: slot.side, empire: slot.empire, ship: slot.ship };
      return { control: slot.control, side: slot.side, empire: option.empire, ship: String(option.index) };
    });
    return { mode: 'shiplist', slots, catalogOnly: false };
  }
  const slots: SlotSnapshot[] = [];
  const count = previous.length > 0 ? previous.length : SKIRMISH_SLOTS;
  const playerOpt = options.find((item) => item.index === player);
  const opponentOpt = options.find((item) => item.index === opponent);
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      slots.push({
        control: 'you',
        side: '0',
        empire: playerOpt?.empire ?? '',
        ship: String(player),
      });
    } else if (i === 1) {
      slots.push({
        control: 'ai',
        side: '1',
        empire: opponentOpt?.empire ?? '',
        ship: String(opponent),
      });
    } else {
      slots.push({ control: 'empty', side: i % 2 === 0 ? '0' : '1', empire: '', ship: '' });
    }
  }
  return { mode: 'shiplist', slots, catalogOnly: false };
}

export function mountSkirmish(host: HTMLElement, notify?: () => void): void {
  onBoardChange = notify ?? null;
  host.replaceChildren();
  rows.length = 0;
  for (let i = 0; i < SKIRMISH_SLOTS; i++) host.append(buildRow(i));
  fillSynthetic('duel');
}

function notifyBoard(): void {
  onBoardChange?.();
}

export function fillSynthetic(preset: 'duel' | '3v3'): void {
  mode = 'synthetic';
  const picks = preset === '3v3' ? PRESET_3V3 : PRESET_DUEL;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pick = picks[i];
    if (!row || !pick) continue;
    fillEmpireOptions(row, null);
    row.control.value = pick.control;
    row.side.value = String(pick.side);
    row.empire.value = pick.empireId;
    fillShipOptions(row);
    row.ship.value = pick.classId;
  }
}

export function fillShiplist(
  options: readonly ShiplistOption[],
  player: number,
  opponent: number,
  opts?: { reset?: boolean },
): void {
  const previous = snapshotSlots();
  const previousMode = mode;
  const resolved = resolveShiplistAssignments(
    previous,
    previousMode,
    options,
    player,
    opponent,
    opts?.reset === true,
  );
  shiplist = options;
  if (resolved.catalogOnly) return;
  mode = 'shiplist';
  const empires: string[] = [];
  for (const option of options) {
    if (!empires.includes(option.empire)) empires.push(option.empire);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const slot = resolved.slots[i];
    if (!row || !slot) continue;
    fillEmpireOptions(row, empires);
    if (slot.control === 'empty') {
      row.control.value = 'empty';
      continue;
    }
    const index = Number(slot.ship);
    const control: 'you' | 'ai' = slot.control === 'you' ? 'you' : 'ai';
    const side: 0 | 1 = slot.side === '1' ? 1 : 0;
    if (Number.isInteger(index)) applyCandidate(row, index, control, side);
    else {
      row.control.value = control;
      row.side.value = slot.side;
    }
  }
}

export function readSkirmish(): SlotChoice[] {
  const out: SlotChoice[] = [];
  let you = false;
  for (const row of rows) {
    if (row.control.value === 'empty') {
      out.push({ control: 'empty' });
      continue;
    }
    let control: 'you' | 'ai' = row.control.value === 'you' ? 'you' : 'ai';
    if (control === 'you') {
      if (you) control = 'ai';
      you = true;
    }
    const side = row.side.value === '1' ? 1 : 0;
    if (mode === 'shiplist') {
      const candidateIndex = Number(row.ship.value);
      if (!Number.isInteger(candidateIndex)) {
        out.push({ control: 'empty' });
        continue;
      }
      out.push({ control, side, kind: 'shiplist', candidateIndex });
      continue;
    }
    const empireId = empireById(row.empire.value)?.id ?? SKIRMISH_EMPIRES[0]!.id;
    const classId = classById(row.ship.value)?.id ?? SKIRMISH_CLASSES[0]!.id;
    out.push({ control, side, kind: 'synthetic', empireId, classId });
  }
  return out;
}

const PRESET_DUEL = [
  { control: 'you', side: 0, empireId: 'federation', classId: 'cruiser' },
  { control: 'ai', side: 1, empireId: 'klingon', classId: 'cruiser' },
  { control: 'empty', side: 0, empireId: 'federation', classId: 'frigate' },
  { control: 'empty', side: 1, empireId: 'klingon', classId: 'frigate' },
  { control: 'empty', side: 0, empireId: 'romulan', classId: 'cruiser' },
  { control: 'empty', side: 1, empireId: 'romulan', classId: 'frigate' },
] as const;

const PRESET_3V3 = [
  { control: 'you', side: 0, empireId: 'federation', classId: 'cruiser' },
  { control: 'ai', side: 0, empireId: 'romulan', classId: 'frigate' },
  { control: 'ai', side: 0, empireId: 'hydran', classId: 'cruiser' },
  { control: 'ai', side: 1, empireId: 'klingon', classId: 'cruiser' },
  { control: 'ai', side: 1, empireId: 'lyran', classId: 'frigate' },
  { control: 'ai', side: 1, empireId: 'gorn', classId: 'cruiser' },
] as const;

function buildRow(index: number): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'skirmish-slot';
  const mark = document.createElement('span');
  mark.textContent = String(index + 1);
  const control = select([
    ['empty', 'Empty'],
    ['you', 'You'],
    ['ai', 'AI'],
  ]);
  const side = select([
    ['0', 'Side A'],
    ['1', 'Side B'],
  ]);
  const empire = document.createElement('select');
  empire.ariaLabel = `Slot ${String(index + 1)} empire`;
  const ship = document.createElement('select');
  ship.ariaLabel = `Slot ${String(index + 1)} ship`;
  control.ariaLabel = `Slot ${String(index + 1)} control`;
  side.ariaLabel = `Slot ${String(index + 1)} side`;
  control.addEventListener('change', () => {
    if (control.value === 'you') {
      for (const other of rows) {
        if (other.control !== control && other.control.value === 'you') other.control.value = 'ai';
      }
    }
    notifyBoard();
  });
  side.addEventListener('change', () => notifyBoard());
  empire.addEventListener('change', () => {
    fillShipOptions(rows[index]!);
    notifyBoard();
  });
  ship.addEventListener('change', () => notifyBoard());
  row.append(mark, control, side, empire, ship);
  rows.push({ control, side, empire, ship });
  return row;
}

function select(options: readonly (readonly [string, string])[]): HTMLSelectElement {
  const node = document.createElement('select');
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    node.append(option);
  }
  return node;
}

function fillEmpireOptions(row: Row, empires: readonly string[] | null): void {
  const previous = row.empire.value;
  row.empire.replaceChildren();
  if (empires) {
    for (const empire of empires) {
      const option = document.createElement('option');
      option.value = empire;
      option.textContent = empire;
      row.empire.append(option);
    }
  } else {
    for (const empire of SKIRMISH_EMPIRES) {
      const option = document.createElement('option');
      option.value = empire.id;
      option.textContent = empire.name;
      row.empire.append(option);
    }
  }
  if (previous) row.empire.value = previous;
}

function fillShipOptions(row: Row): void {
  const previous = row.ship.value;
  row.ship.replaceChildren();
  if (mode === 'shiplist') {
    for (const option of shiplist) {
      if (option.empire !== row.empire.value) continue;
      const node = document.createElement('option');
      node.value = String(option.index);
      node.textContent = option.label;
      row.ship.append(node);
    }
  } else {
    for (const hull of SKIRMISH_CLASSES) {
      const node = document.createElement('option');
      node.value = hull.id;
      node.textContent = hull.name;
      row.ship.append(node);
    }
  }
  if (previous) row.ship.value = previous;
  if (row.ship.value === '' && row.ship.options.length > 0) row.ship.selectedIndex = 0;
}

function applyCandidate(row: Row, index: number, control: 'you' | 'ai', side: 0 | 1): void {
  const option = shiplist.find((item) => item.index === index);
  row.control.value = control;
  row.side.value = String(side);
  if (option) row.empire.value = option.empire;
  fillShipOptions(row);
  row.ship.value = String(index);
}
