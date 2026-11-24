/**
 * Build a duel from a folder or zip the player supplies.
 * Original files stay in the browser. Missing models use the placeholder hull.
 */
import { parseShiplist } from '@sfc2js/formats';
import { importInstall, importZipArchive, type PickedFile, type Vfs } from '@sfc2js/platform';
import { Group } from 'three';
import type { RosterEntry } from '../../engine/duel/fixture.ts';
import { createDuelMatch, type DuelMatch } from '../../engine/duel/match.ts';
import { SYNTHETIC_SPAWNS } from '../../engine/duel/fixture.ts';
import { groupFromMod } from '../../engine/duel/meshes.ts';
import { placeholderHullMod, type PlaceholderShape } from '../../engine/duel/placeholder-mod.ts';
import { FIXTURE_MODEL_DIR } from '../../engine/duel/placeholder-mod.ts';
import {
  candidatesFromShiplist,
  chooseDefaultPair,
  type DuelCandidate,
} from '../../engine/duel/roster.ts';

const ACCENTS: readonly { test: string; accent: string }[] = [
  { test: 'fed', accent: '#4F8FD6' },
  { test: 'kling', accent: '#B23A3A' },
  { test: 'rom', accent: '#3FA36B' },
  { test: 'lyr', accent: '#D9A441' },
  { test: 'hyd', accent: '#3FB5A8' },
  { test: 'gorn', accent: '#7FA640' },
  { test: 'isc', accent: '#D0D4DA' },
  { test: 'mirak', accent: '#C46A2E' },
  { test: 'orion', accent: '#9B6BD1' },
];

const TINTS = [
  { r: 79, g: 143, b: 214 },
  { r: 178, g: 58, b: 58 },
];

export interface LoadedDuel {
  match: DuelMatch;
  groups: Group[];
  roster: RosterEntry[];
  note: string;
  vfs: Vfs;
  candidates: readonly DuelCandidate[];
  player: number;
  opponent: number;
}

export async function duelFromFiles(files: readonly PickedFile[]): Promise<LoadedDuel | { error: string }> {
  const imported = await importInstall(files);
  return finish(imported.vfs, imported.shiplist.assets ?? imported.shiplist.metaassets, imported.diagnostics.map((item) => item.code).join(', '));
}

export async function duelFromZip(bytes: Uint8Array): Promise<LoadedDuel | { error: string }> {
  const imported = await importZipArchive(bytes);
  return finish(imported.vfs, imported.shiplist.assets ?? imported.shiplist.metaassets, imported.diagnostics.map((item) => item.code).join(', '));
}

async function finish(
  vfs: Awaited<ReturnType<typeof importInstall>>['vfs'],
  shiplistPath: string | null,
  diagnosticNote: string,
): Promise<LoadedDuel | { error: string }> {
  if (!vfs || !shiplistPath) {
    return { error: diagnosticNote.length > 0 ? diagnosticNote : 'No shiplist in that folder.' };
  }
  const bytes = await vfs.read(shiplistPath);
  if (!bytes) return { error: 'The shiplist could not be read.' };
  const parsed = parseShiplist(bytes, { file: shiplistPath });
  const candidates = candidatesFromShiplist(parsed.data.rows, parsed.data.columns);
  const choice = chooseDefaultPair(candidates);
  if (!choice) return { error: 'Need two ships from different empires with a phaser or photon.' };
  const player = candidates.indexOf(choice.player);
  const opponent = candidates.indexOf(choice.opponent);
  return assembleDuel(vfs, candidates, player, opponent, choice.note);
}

export async function assembleDuel(
  vfs: Vfs,
  candidates: readonly DuelCandidate[],
  player: number,
  opponent: number,
  note: string,
): Promise<LoadedDuel | { error: string }> {
  const left = candidates[player];
  const right = candidates[opponent];
  if (!left || !right || player === opponent) return { error: 'Choose two different ships.' };
  const pair = [left, right];
  const groups: Group[] = [];
  let missingModel = false;
  for (let i = 0; i < pair.length; i++) {
    const item = pair[i];
    if (!item) continue;
    const path = item.geometry.replaceAll('\\', '/');
    const resolved = path.length > 0 ? vfs.resolve(path) : null;
    const modelBytes = resolved ? await vfs.read(resolved) : null;
    if (!modelBytes) missingModel = true;
    const tint = TINTS[i] ?? TINTS[0]!;
    const shape: PlaceholderShape = i === 0 ? 'ca' : 'd7';
    const modelPath = resolved ?? `${FIXTURE_MODEL_DIR}/test-${shape}.mod`;
    const group = await groupFromMod(modelBytes ?? placeholderHullMod(tint, shape), modelPath, vfs);
    groups.push(group ?? new Group());
  }
  const match = createDuelMatch({
    seed: 0x0d0e1,
    setups: pair.map((item) => item.setup),
    spawns: SYNTHETIC_SPAWNS,
    timeScale: 4,
  });
  const hullNote = missingModel ? ' Placeholder hulls stand in where a model was missing.' : '';
  return {
    match,
    groups,
    roster: pair.map((item) => rosterOf(item)),
    note: `${note}${hullNote}`,
    vfs,
    candidates,
    player,
    opponent,
  };
}

function rosterOf(candidate: DuelCandidate): RosterEntry {
  return {
    name: candidate.className.length > 0 ? candidate.className : candidate.spawnKey,
    empire: candidate.race.length > 0 ? candidate.race : 'Empire',
    accent: accentFor(candidate.race),
    modelFile: candidate.geometry,
  };
}

function accentFor(empire: string): string {
  const lower = empire.toLowerCase();
  for (const row of ACCENTS) {
    if (lower.includes(row.test)) return row.accent;
  }
  return '#4F8FD6';
}
