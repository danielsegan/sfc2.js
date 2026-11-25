/**
 * Which two shiplist rows a duel starts with.
 * The reference pair is a Federation heavy cruiser (race Federation, hull CA,
 * class name F-CA when that row exists) against a Klingon D7 (class K-D7, or
 * the closest Klingon cruiser hull). Rows are matched by race and hull type,
 * not by how early they sit in the file. If either side is missing, the
 * fallback is the first two supported ships from different empires.
 */
import type { ShiplistRow } from '../../tools/formats/shiplist.ts';
import { bindShiplistRow, shiplistText, type ShipSetup } from '../sim/bind-shiplist.ts';
import {
  CLASS_SHIP,
  INTERNAL_PHASER,
  INTERNAL_PHOTON,
  weaponDef,
  weaponId,
} from '../sim/rules-tables.ts';

/** Closeness to a heavy cruiser. CA is the reference hull. Unverified as a CE ordering. */
const KLINGON_CRUISER_HULLS = ['ca', 'cl', 'bc', 'dn'] as const;

export interface DuelCandidate {
  readonly index: number;
  readonly line: number;
  readonly spawnKey: string;
  readonly race: string;
  readonly hullType: string;
  readonly className: string;
  /** Shiplist full name. Empty when the file has no name column. */
  readonly displayName: string;
  readonly geometry: string;
  /** At least one phaser or photon the duel slice can charge. */
  readonly supported: boolean;
  readonly setup: ShipSetup;
}

export interface DuelChoice {
  readonly player: DuelCandidate;
  readonly opponent: DuelCandidate;
  readonly source: 'reference' | 'fallback';
  readonly note: string;
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function supportedMount(setup: ShipSetup): boolean {
  for (const mount of setup.mounts) {
    const def = weaponDef(weaponId(mount.weapon));
    if (def && (def.internal === INTERNAL_PHASER || def.internal === INTERNAL_PHOTON)) return true;
  }
  return false;
}

export function candidatesFromShiplist(rows: readonly ShiplistRow[], columns: readonly string[]): DuelCandidate[] {
  const out: DuelCandidate[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;
    let setup: ShipSetup;
    try {
      setup = bindShiplistRow(row, columns);
    } catch {
      continue;
    }
    if (setup.classCode !== CLASS_SHIP) continue;
    out.push({
      index,
      line: row.line,
      spawnKey: row.spawnKey,
      race: shiplistText(columns, row.raw, ['race']),
      hullType: shiplistText(columns, row.raw, ['hull type', 'hulltype', 'hull']),
      className: shiplistText(columns, row.raw, ['class', 'class name', 'classname']),
      displayName: shiplistText(columns, row.raw, ['full name', 'name', 'display name']),
      geometry: shiplistText(columns, row.raw, ['geometry']),
      supported: supportedMount(setup),
      setup,
    });
  }
  return out;
}

/** Plate and target-list name. A real install uses the shiplist name. Synthetic rows keep the class token. */
export function shipPlateName(candidate: DuelCandidate): string {
  const named = candidate.displayName.trim();
  if (named.length > 0) return named;
  if (candidate.className.length > 0) return candidate.className;
  return candidate.spawnKey;
}

export function candidateLabel(candidate: DuelCandidate): string {
  const weapon = candidate.supported ? 'phaser or photon' : 'no phaser or photon';
  return `${candidate.race} ${shipPlateName(candidate)} (${candidate.hullType}) — ${weapon}`;
}

function describeRow(candidate: DuelCandidate): string {
  return `${candidate.spawnKey} (line ${String(candidate.line)}, hull ${candidate.hullType})`;
}

function pickPlayer(ships: readonly DuelCandidate[]): DuelCandidate | null {
  const pool = ships.filter(
    (ship) => ship.supported && norm(ship.race) === 'federation' && norm(ship.hullType) === 'ca',
  );
  return pool.find((ship) => norm(ship.className) === 'f-ca') ?? pool[0] ?? null;
}

function pickOpponent(ships: readonly DuelCandidate[], player: DuelCandidate | null): DuelCandidate | null {
  const pool = ships.filter(
    (ship) => ship.supported && norm(ship.race) === 'klingon' && ship.index !== player?.index,
  );
  const named = pool.find((ship) => norm(ship.className) === 'k-d7');
  if (named) return named;
  for (const hull of KLINGON_CRUISER_HULLS) {
    const found = pool.find((ship) => norm(ship.hullType) === hull);
    if (found) return found;
  }
  return null;
}

function pickFallback(ships: readonly DuelCandidate[]): { player: DuelCandidate; opponent: DuelCandidate } | null {
  const pool = ships.filter((ship) => ship.supported);
  const first = pool[0];
  if (!first) return null;
  const other = pool.find((ship) => ship.index !== first.index && norm(ship.race) !== norm(first.race));
  if (!other) return null;
  return { player: first, opponent: other };
}

export function chooseDefaultPair(candidates: readonly DuelCandidate[]): DuelChoice | null {
  const player = pickPlayer(candidates);
  const opponent = pickOpponent(candidates, player);
  if (player && opponent) {
    return {
      player,
      opponent,
      source: 'reference',
      note: `Player ${describeRow(player)} vs ${describeRow(opponent)}.`,
    };
  }
  const fallback = pickFallback(candidates);
  if (!fallback) return null;
  return {
    player: fallback.player,
    opponent: fallback.opponent,
    source: 'fallback',
    note: `Federation CA or Klingon D7 was not both available. Fallback ${describeRow(fallback.player)} vs ${describeRow(fallback.opponent)}.`,
  };
}
