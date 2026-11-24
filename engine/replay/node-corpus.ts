import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { EMPTY_GAME_DATABASE } from '../core/database.ts';
import { decodeReplay, encodeReplay, REPLAY_EXTENSION, type HashSample, type ReplayFile } from './format.ts';
import { playReplay, recordReplay, runtimeStamp, type PlayResult } from './playback.ts';
import { formatFailure, formatOk } from './report.ts';
import { CORPUS } from './scenarios/index.ts';
import type { CorpusScript } from './scenarios/types.ts';
import { listSimSourcePaths, readSourceFiles } from './sources.ts';

export interface CorpusRow {
  readonly file: string;
  readonly ok: boolean;
  readonly kind: string;
  readonly detail: string;
  readonly report: string;
  readonly hashes: readonly HashSample[];
}

function fileLabel(root: string, dir: string, fileName: string): string {
  const rel = relative(root, join(dir, fileName)).split(sep).join('/');
  if (rel.startsWith('..') || rel.startsWith('/')) {
    return `${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/${fileName}`;
  }
  return rel;
}

export function loadSimSources(root: string) {
  return readSourceFiles(root, listSimSourcePaths(root));
}

export function recordScript(
  root: string,
  script: CorpusScript,
  dataHash = EMPTY_GAME_DATABASE.dataHash,
): ReplayFile {
  return recordReplay({
    scenario: script.scenario,
    seed: script.seed,
    ticks: script.ticks,
    slots: script.slots,
    inputDelay: script.inputDelay,
    hashPeriod: script.hashPeriod,
    commands: script.commands,
    simSources: loadSimSources(root),
    scenarioSources: readSourceFiles(root, script.scenario.sourcePaths),
    dataHash,
  });
}

export function recordCorpus(root: string, dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const script of CORPUS) {
    writeFileSync(join(dir, script.fileName), encodeReplay(recordScript(root, script)));
  }
}

export function checkCorpus(root: string, dir: string): { ok: boolean; rows: CorpusRow[] } {
  const present = readdirSync(dir)
    .filter((name) => name.endsWith(REPLAY_EXTENSION))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const expected = CORPUS.map((script) => script.fileName);
  const rows: CorpusRow[] = [];
  let ok = true;
  for (const name of present) {
    let known = false;
    for (const fileName of expected) {
      if (fileName === name) known = true;
    }
    if (known) continue;
    ok = false;
    const label = fileLabel(root, dir, name);
    rows.push({
      file: label,
      ok: false,
      kind: 'format',
      detail: 'replay is not in the corpus manifest',
      report: `FAIL ${label}\nreplay is not in the corpus manifest`,
      hashes: [],
    });
  }
  for (const script of CORPUS) {
    const label = fileLabel(root, dir, script.fileName);
    let found = false;
    for (const name of present) {
      if (name === script.fileName) found = true;
    }
    if (!found) {
      ok = false;
      rows.push({
        file: label,
        ok: false,
        kind: 'format',
        detail: 'missing corpus file',
        report: `FAIL ${label}\nmissing corpus file`,
        hashes: [],
      });
      continue;
    }
    const bytes = new Uint8Array(readFileSync(join(dir, script.fileName)));
    const row = checkBytes(root, label, script, bytes);
    if (!row.ok) ok = false;
    rows.push(row);
  }
  return { ok, rows };
}

export function checkBytes(root: string, label: string, script: CorpusScript, bytes: Uint8Array): CorpusRow {
  const decoded = decodeReplay(bytes);
  if (!decoded.ok) {
    const stale = decoded.error.startsWith('unsupported replayFormat');
    const kind = stale ? 'stale' : 'format';
    const report = `${stale ? 'STALE' : 'FAIL'} ${label}\n${decoded.error}`;
    return { file: label, ok: false, kind, detail: decoded.error, report, hashes: [] };
  }
  if (decoded.replay.scenarioId !== script.scenario.id) {
    const detail = `file is ${decoded.replay.scenarioId}, manifest entry is ${script.scenario.id}`;
    return {
      file: label,
      ok: false,
      kind: 'format',
      detail,
      report: `FAIL ${label}\n${detail}`,
      hashes: [],
    };
  }
  const runtime = runtimeStamp(
    loadSimSources(root),
    readSourceFiles(root, script.scenario.sourcePaths),
    EMPTY_GAME_DATABASE.dataHash,
  );
  const played = playReplay(decoded.replay, script.scenario, runtime);
  return rowFromPlay(label, decoded.replay, played);
}

export function rowFromPlay(label: string, replay: ReplayFile, played: PlayResult): CorpusRow {
  if (played.ok) {
    return {
      file: label,
      ok: true,
      kind: 'ok',
      detail: '',
      report: formatOk(label, replay),
      hashes: played.hashes,
    };
  }
  return {
    file: label,
    ok: false,
    kind: played.kind,
    detail: played.detail,
    report: formatFailure(label, replay, played),
    hashes: played.hashes,
  };
}
