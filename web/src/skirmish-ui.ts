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

interface Row {
  readonly control: HTMLSelectElement;
  readonly side: HTMLSelectElement;
  readonly empire: HTMLSelectElement;
  readonly ship: HTMLSelectElement;
}

let mode: 'synthetic' | 'shiplist' = 'synthetic';
let shiplist: readonly ShiplistOption[] = [];
const rows: Row[] = [];

export function skirmishMode(): 'synthetic' | 'shiplist' {
  return mode;
}

export function mountSkirmish(host: HTMLElement): void {
  host.replaceChildren();
  rows.length = 0;
  for (let i = 0; i < SKIRMISH_SLOTS; i++) host.append(buildRow(i));
  fillSynthetic('duel');
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

export function fillShiplist(options: readonly ShiplistOption[], player: number, opponent: number): void {
  mode = 'shiplist';
  shiplist = options;
  const empires: string[] = [];
  for (const option of options) {
    if (!empires.includes(option.empire)) empires.push(option.empire);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    fillEmpireOptions(row, empires);
    if (i === 0) applyCandidate(row, player, 'you', 0);
    else if (i === 1) applyCandidate(row, opponent, 'ai', 1);
    else row.control.value = 'empty';
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
    if (control.value !== 'you') return;
    for (const other of rows) {
      if (other.control !== control && other.control.value === 'you') other.control.value = 'ai';
    }
  });
  empire.addEventListener('change', () => fillShipOptions(rows[index]!));
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
