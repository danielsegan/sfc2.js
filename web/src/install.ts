/**
 * Build a duel from a folder or zip the player supplies.
 * Original files stay in the browser. Missing models use the placeholder hull.
 */
import { parseShiplist } from '@sfc2js/formats';
import { importInstall, importZipArchive, type PickedFile } from '@sfc2js/platform';
import { Group } from 'three';
import { bindShiplistRow, type ShipSetup } from '../../engine/sim/bind-shiplist.ts';
import { CLASS_SHIP } from '../../engine/sim/rules-tables.ts';
import type { RosterEntry } from '../../engine/duel/fixture.ts';
import { createDuelMatch, type DuelMatch } from '../../engine/duel/match.ts';
import { SYNTHETIC_SPAWNS } from '../../engine/duel/fixture.ts';
import { groupFromMod } from '../../engine/duel/meshes.ts';
import { placeholderHullMod } from '../../engine/duel/placeholder-mod.ts';
import { FIXTURE_MODEL_DIR } from '../../engine/duel/placeholder-mod.ts';

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
  const chosen: { setup: ShipSetup; roster: RosterEntry; geometry: string }[] = [];
  for (const row of parsed.data.rows) {
    if (chosen.length >= 2) break;
    let setup: ShipSetup;
    try {
      setup = bindShiplistRow(row, parsed.data.columns);
    } catch {
      continue;
    }
    if (setup.classCode !== CLASS_SHIP) continue;
    const parts = row.spawnKey.split(':');
    const empire = parts[0] ?? 'Empire';
    const name = parts[1] ?? row.spawnKey;
    chosen.push({
      setup,
      geometry: geometryCell(parsed.data.columns, row.raw),
      roster: {
        name,
        empire,
        accent: accentFor(empire),
        modelFile: geometryCell(parsed.data.columns, row.raw),
      },
    });
  }
  if (chosen.length < 2) return { error: 'Need two ship rows in the shiplist.' };
  const groups: Group[] = [];
  for (let i = 0; i < chosen.length; i++) {
    const item = chosen[i];
    if (!item) continue;
    const path = item.geometry.replaceAll('\\', '/');
    const resolved = path.length > 0 ? vfs.resolve(path) : null;
    const modelBytes = resolved ? await vfs.read(resolved) : null;
    const tint = TINTS[i] ?? TINTS[0]!;
    const modelPath = resolved ?? `${FIXTURE_MODEL_DIR}/wedge-player.mod`;
    const group = await groupFromMod(modelBytes ?? placeholderHullMod(tint), modelPath, vfs);
    groups.push(group ?? new Group());
  }
  const match = createDuelMatch({
    seed: 0x0d0e1,
    setups: chosen.map((item) => item.setup),
    spawns: SYNTHETIC_SPAWNS,
    timeScale: 4,
  });
  const placeholder = groups.some((_, index) => {
    const item = chosen[index];
    return !item || item.geometry.length === 0;
  });
  return {
    match,
    groups,
    roster: chosen.map((item) => item.roster),
    note: placeholder ? 'Player shiplist, placeholder hulls where a model was missing.' : 'Player install.',
  };
}

function geometryCell(columns: readonly string[], raw: readonly string[]): string {
  for (let i = 0; i < columns.length; i++) {
    if (norm(columns[i] ?? '') === 'geometry') return (raw[i] ?? '').trim();
  }
  return '';
}

function norm(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', ' ');
}

function accentFor(empire: string): string {
  const lower = empire.toLowerCase();
  for (const row of ACCENTS) {
    if (lower.includes(row.test)) return row.accent;
  }
  return '#4F8FD6';
}
