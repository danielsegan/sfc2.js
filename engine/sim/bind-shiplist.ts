/**
 * Bind a parsed shiplist row into duel-slice ship state.
 * The parser keeps file units. Shield side-column factor, end factor, and
 * facing pairing come from docs/rules/data/measured.json. A null override
 * keeps today's fallback. Warp side ×2 and warp centre ×1 stay here.
 * Move cost is parsed from the raw cell into hundredths. No float conversion.
 */
import measured from '../../docs/rules/data/measured.json' with { type: 'json' };
import type { Diagnostic } from '../../tools/formats/diagnostics.ts';
import type { ShiplistRow } from '../../tools/formats/shiplist.ts';
import {
  CLASS_FIGHTER,
  CLASS_PF,
  CLASS_SHIP,
  ENERGY_SCALE,
  MODE_NORMAL,
  turnModeId,
  weaponId,
} from './rules-tables.ts';

export interface MountSetup {
  slotIndex: number;
  weapon: string;
  arc: string | null;
  chargePoints: number;
  boxes: number;
  mode: number;
  ticksCharging: number;
}

export interface ShipSystemsSetup {
  readonly armor?: number;
  readonly bridge?: number;
  readonly hullForward?: number;
  readonly hullCenter?: number;
  readonly hullAft?: number;
  readonly sensors?: number;
  readonly extraDamage?: number;
}

export interface ShipSetup {
  classCode: number;
  warp: number;
  impulse: number;
  apr: number;
  battery: number;
  batteryCapacity: number;
  moveCost100: number;
  turnMode: number;
  /** -1 when the file left acceleration empty: the hull does not move. */
  acceleration: number;
  speed: number;
  shields: readonly number[];
  shieldsMax: readonly number[];
  crew: number;
  minCrew: number;
  fcPaid: number;
  destroyed: number;
  disabled: number;
  /** Free ECM from the stealth column. May be negative. Omitted means 0. */
  stealth?: number;
  /** Scanner boxes. Each one extends cloak detection. Omitted means 0. */
  scanners?: number;
  /** Special-sensor boxes. They can spot a cloak the range check missed. */
  specialSensors?: number;
  /** Tractor boxes. Empty or omitted means the hull has no tractor. */
  tractors?: number;
  /** Energy per rules-turn to run a cloak. Empty or omitted means no cloak. */
  cloakCost?: number;
  systems?: ShipSystemsSetup;
  mounts: readonly MountSetup[];
}

function normHeader(raw: string): string {
  let out = '';
  let prevSpace = false;
  for (let i = 0; i < raw.length; i++) {
    let c = raw.charCodeAt(i);
    if (c >= 65 && c <= 90) c += 32;
    if (c === 32 || c === 9) {
      if (!prevSpace && out.length > 0) out += ' ';
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    out += String.fromCharCode(c);
  }
  while (out.length > 0 && out.charCodeAt(out.length - 1) === 95) out = out.slice(0, -1);
  return out;
}

function upperAscii(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out += String.fromCharCode(c >= 97 && c <= 122 ? c - 32 : c);
  }
  return out;
}

export function shiplistText(columns: readonly string[], raw: readonly string[], aliases: readonly string[]): string {
  return (cell(columns, raw, aliases) ?? '').trim();
}

function cell(columns: readonly string[], raw: readonly string[], aliases: readonly string[]): string | undefined {
  for (let i = 0; i < columns.length; i++) {
    const name = normHeader(columns[i] ?? '');
    for (const alias of aliases) {
      if (name === alias) return raw[i] ?? '';
    }
  }
  return undefined;
}

/** Whole file integer. Empty is 0. A fraction or other text is rejected. */
export function parseWhole(text: string): number | null {
  const s = text.trim();
  if (s.length === 0) return 0;
  let i = 0;
  let sign = 1;
  const head = s.charCodeAt(0);
  if (head === 45) {
    sign = -1;
    i = 1;
  } else if (head === 43) i = 1;
  if (i >= s.length) return null;
  let value = 0;
  for (; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return null;
    value = value * 10 + (c - 48);
  }
  return sign < 0 ? -value : value;
}

/**
 * File decimal with at most two digits after the point, as hundredths.
 * "0.75" is 75, "1" is 100, "0.4" is 40. Empty is 0.
 */
export function parseHundredths(text: string): number | null {
  const s = text.trim();
  if (s.length === 0) return 0;
  let i = 0;
  let sign = 1;
  const head = s.charCodeAt(0);
  if (head === 45) {
    sign = -1;
    i = 1;
  } else if (head === 43) i = 1;
  let whole = 0;
  let sawDigit = false;
  for (; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 46) {
      i += 1;
      break;
    }
    if (c < 48 || c > 57) return null;
    sawDigit = true;
    whole = whole * 10 + (c - 48);
  }
  let frac = 0;
  let digits = 0;
  for (; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return null;
    digits += 1;
    if (digits > 2) return null;
    frac = frac * 10 + (c - 48);
  }
  if (!sawDigit && digits === 0) return null;
  if (digits === 1) frac *= 10;
  const hundredths = whole * ENERGY_SCALE + frac;
  return sign < 0 ? -hundredths : hundredths;
}

export interface ShieldPairing {
  readonly front: readonly number[];
  readonly forwardSide: readonly number[];
  readonly aftSide: readonly number[];
  readonly rear: readonly number[];
}

export interface ShieldMeasure {
  readonly sideColumnFactor: number | null;
  readonly endFactor: number | null;
  readonly pairing: ShieldPairing | null;
}

function wholeFactor(value: number | null, fallback: number, name: string): number {
  const chosen = value == null ? fallback : value;
  if (!Number.isInteger(chosen) || chosen < 0) throw new Error(name);
  return chosen;
}

function placeFacing(out: number[], index: number, points: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 5 || out[index] !== -1) throw new Error('shield pairing');
  out[index] = points;
}

/**
 * Fan four file cells onto six facings, then apply the factors.
 * `measure` null fields use the fallbacks in measured.json.
 */
export function shieldMaxFromCells(
  front: number,
  forward: number,
  aft: number,
  rear: number,
  measure?: ShieldMeasure,
): number[] {
  const source = measure ?? {
    sideColumnFactor: measured.shields.sideColumnFactor,
    endFactor: measured.shields.endFactor,
    pairing: measured.shields.pairing,
  };
  const side = wholeFactor(source.sideColumnFactor, measured.shields.fallbackSideColumnFactor, 'side column factor');
  const end = wholeFactor(source.endFactor, measured.shields.fallbackEndFactor, 'end factor');
  const pairing = source.pairing ?? measured.shields.fallbackPairing;
  const out = [-1, -1, -1, -1, -1, -1];
  for (const index of pairing.front) placeFacing(out, index, front * end);
  for (const index of pairing.forwardSide) placeFacing(out, index, forward * side);
  for (const index of pairing.aftSide) placeFacing(out, index, aft * side);
  for (const index of pairing.rear) placeFacing(out, index, rear * end);
  if (out.some((value) => value < 0)) throw new Error('shield pairing');
  return out;
}

function wholeCell(columns: readonly string[], raw: readonly string[], aliases: readonly string[], fallback: number): number {
  const text = cell(columns, raw, aliases);
  if (text === undefined) return fallback;
  const parsed = parseWhole(text);
  if (parsed === null) throw new Error(`bad integer cell ${aliases[0] ?? ''}`);
  return parsed;
}

/**
 * Bind one row. A non-empty weapon code that is not in the catalog is
 * `unknownWeapon` and is not mounted. It is not given a zero cost.
 */
export function bindShiplistRow(
  row: ShiplistRow,
  columns: readonly string[],
  diagnostics?: Diagnostic[],
): ShipSetup {
  const raw = row.raw;
  const front = wholeCell(columns, raw, ['shield 1', 'shield front', 'front shield'], 0);
  // CE 2.670 names the shared side cells with the paired SFB shield numbers.
  // `Shield 2 _ 6` is forward-side (facings 1 and 5). `Shield 3 _ 5` is aft-side (facings 2 and 4).
  const forward = wholeCell(columns, raw, ['shield 2', 'shield 2 _ 6', 'shield forward side', 'forward side'], 0);
  const aft = wholeCell(columns, raw, ['shield 3', 'shield 3 _ 5', 'shield aft side', 'aft side'], 0);
  const rear = wholeCell(columns, raw, ['shield 4', 'shield rear', 'rear shield'], 0);
  const shieldsMax = shieldMaxFromCells(front, forward, aft, rear);
  const warpSide = wholeCell(columns, raw, ['warp side', 'side warp', 'r_l_warp'], 0);
  const warpCenter = wholeCell(columns, raw, ['warp center', 'warp centre', 'c_warp'], 0);
  const moveText = cell(columns, raw, ['move cost']);
  const moveCost100 = parseHundredths(moveText ?? '');
  if (moveCost100 === null) throw new Error('bad move cost');
  const accelText = cell(columns, raw, ['acceleration']);
  let acceleration = -1;
  if (accelText !== undefined && accelText.trim() !== '') {
    const parsed = parseWhole(accelText);
    if (parsed === null) throw new Error('bad acceleration');
    acceleration = parsed;
  }
  const turnText = (cell(columns, raw, ['turn mode']) ?? '').trim();
  const hull = upperAscii((cell(columns, raw, ['hull type', 'hulltype', 'hull']) ?? '').trim());
  let classCode = CLASS_SHIP;
  if (hull === 'FTR') classCode = CLASS_FIGHTER;
  else if (hull === 'PF') classCode = CLASS_PF;
  const mounts: MountSetup[] = [];
  for (const hardpoint of row.hardpoints) {
    if (hardpoint.weapon == null || hardpoint.weapon === '') continue;
    if (weaponId(hardpoint.weapon) === 0) {
      diagnostics?.push({
        code: 'unknownWeapon',
        source: 'loader',
        severity: 'warning',
        details: { spawnKey: row.spawnKey, slotIndex: hardpoint.slotIndex, code: hardpoint.weapon },
        location: { line: row.line },
      });
      continue;
    }
    const count = hardpoint.count != null && hardpoint.count > 0 ? hardpoint.count : 1;
    mounts.push({
      slotIndex: hardpoint.slotIndex,
      weapon: hardpoint.weapon,
      arc: hardpoint.arc,
      chargePoints: 0,
      boxes: count,
      mode: MODE_NORMAL,
      ticksCharging: 0,
    });
  }
  const battery = wholeCell(columns, raw, ['battery'], 0);
  return {
    classCode,
    warp: warpSide * 2 + warpCenter,
    impulse: wholeCell(columns, raw, ['impulse'], 0),
    apr: wholeCell(columns, raw, ['apr'], 0),
    battery,
    batteryCapacity: battery,
    moveCost100,
    turnMode: turnText === '' ? turnModeId('H') : turnModeId(turnText),
    acceleration,
    speed: 0,
    shields: shieldsMax.slice(),
    shieldsMax,
    crew: wholeCell(columns, raw, ['crew', 'regular crew'], 0),
    minCrew: wholeCell(columns, raw, ['min crew'], 0),
    fcPaid: 0,
    destroyed: 0,
    disabled: 0,
    stealth: wholeCell(columns, raw, ['stealth', 'stealth (+ecm)'], 0),
    scanners: wholeCell(columns, raw, ['scanners'], 0),
    specialSensors: wholeCell(columns, raw, ['special sensors'], 0),
    tractors: wholeCell(columns, raw, ['tractors'], 0),
    cloakCost: wholeCell(columns, raw, ['cloak', 'cloak cost', 'cloakcost'], 0),
    systems: {
      sensors: wholeCell(columns, raw, ['sensors'], 0),
    },
    mounts,
  };
}
