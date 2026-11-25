import { compareCommands } from '../core/codec.ts';
import { LEGACY_REPLAY_FORMAT, REPLAY_FORMAT, simSourceHash, versionHash, type SourceFile } from '../core/version.ts';
import { hashEvents, type Sim } from '../sim/sim.ts';
import {
  commandLogError,
  encodeSettings,
  isPlayerSlot,
  sampleTicks,
  type HashSample,
  type ReplayFile,
  type ReplaySettings,
} from './format.ts';
import { hex32 } from './hex.ts';
import type { Scenario } from './scenarios/types.ts';

export interface RecordRequest {
  readonly scenario: Scenario;
  readonly seed: number;
  readonly ticks: number;
  readonly slots: readonly number[];
  readonly inputDelay: number;
  readonly hashPeriod: number;
  readonly commands: ReplayFile['commands'];
  readonly simSources: readonly SourceFile[];
  readonly scenarioSources: readonly SourceFile[];
  readonly dataHash: number;
}

export interface RuntimeStamp {
  readonly simSourceHash: number;
  readonly dataHash: number;
  readonly scenarioHash: number;
}

export interface Divergence {
  readonly tick: number;
  readonly stateExpected: number;
  readonly stateActual: number;
  readonly eventExpected: number;
  readonly eventActual: number;
}

export interface PlayResult {
  readonly ok: boolean;
  readonly kind: 'ok' | 'stale' | 'divergence' | 'format' | 'error';
  readonly detail: string;
  readonly hashes: readonly HashSample[];
  readonly divergence?: Divergence;
  readonly staleParts?: readonly string[];
}

function commandsForTick(commands: ReplayFile['commands'], tick: number): ReplayFile['commands'] {
  const out: ReplayFile['commands'][number][] = [];
  for (const cmd of commands) {
    if ((cmd.tick as number) === tick) out.push(cmd);
  }
  return out;
}

function pushSample(hashes: HashSample[], tick: number, stateHash: number, eventHash: number): void {
  hashes.push({ tick, stateHash, eventHash });
}

function mismatch(sample: HashSample, stateHash: number, eventHash: number): Divergence | null {
  if (sample.stateHash === stateHash && sample.eventHash === eventHash) return null;
  return {
    tick: sample.tick,
    stateExpected: sample.stateHash,
    stateActual: stateHash,
    eventExpected: sample.eventHash,
    eventActual: eventHash,
  };
}

function mismatchDetail(d: Divergence): string {
  const state = d.stateExpected !== d.stateActual;
  const event = d.eventExpected !== d.eventActual;
  if (state && event) return 'stateHash and eventHash mismatch';
  if (state) return 'stateHash mismatch';
  return 'eventHash mismatch';
}

function fail(
  kind: PlayResult['kind'],
  detail: string,
  hashes: readonly HashSample[],
  extra?: { divergence?: Divergence; staleParts?: readonly string[] },
): PlayResult {
  return {
    ok: false,
    kind,
    detail,
    hashes,
    divergence: extra?.divergence,
    staleParts: extra?.staleParts,
  };
}

function sortedSlots(slots: readonly number[]): number[] {
  const out: number[] = [];
  for (const slot of slots) out.push(slot);
  out.sort((a, b) => a - b);
  const unique: number[] = [];
  for (const slot of out) {
    if (unique.length === 0 || unique[unique.length - 1] !== slot) unique.push(slot);
  }
  return unique;
}

export function recordReplay(request: RecordRequest): ReplayFile {
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) {
    throw new Error('seed');
  }
  if (!Number.isInteger(request.ticks) || request.ticks < 1 || request.ticks > 100000) {
    throw new Error('ticks');
  }
  const settings: ReplaySettings = {
    inputDelay: request.inputDelay,
    hashPeriod: request.hashPeriod,
  };
  encodeSettings(settings);
  const slots = sortedSlots(request.slots);
  for (const slot of slots) {
    if (!isPlayerSlot(slot)) throw new Error('slots');
  }
  const commands = request.commands.slice().sort(compareCommands);
  const logError = commandLogError(commands, slots, request.ticks);
  if (logError) throw new Error(logError);
  const sourceHash = simSourceHash(request.simSources);
  const scenarioHash = simSourceHash(request.scenarioSources);
  const sim = request.scenario.create(request.seed);
  const snapshot = sim.snapshot();
  const wanted = sampleTicks(request.ticks, request.hashPeriod);
  const hashes: HashSample[] = [];
  let wantIndex = 0;
  const take = (tick: number, stateHash: number, eventHash: number): void => {
    if (wanted[wantIndex] !== tick) return;
    pushSample(hashes, tick, stateHash, eventHash);
    wantIndex += 1;
  };
  take(0, sim.stateHash(), hashEvents([]));
  for (let tick = 1; tick <= request.ticks; tick++) {
    const result = sim.step(commandsForTick(commands, tick));
    take(tick, result.hash, result.eventHash);
  }
  if (wantIndex !== wanted.length) throw new Error('hash cadence');
  return {
    replayFormat: REPLAY_FORMAT,
    simSourceHash: sourceHash,
    dataHash: request.dataHash >>> 0,
    versionHash: versionHash(REPLAY_FORMAT, sourceHash, request.dataHash),
    scenarioHash,
    seed: request.seed >>> 0,
    tickCount: request.ticks,
    scenarioId: request.scenario.id,
    settings,
    slots,
    snapshot,
    commands,
    hashes,
  };
}

export function runtimeStamp(
  simSources: readonly SourceFile[],
  scenarioSources: readonly SourceFile[],
  dataHash: number,
): RuntimeStamp {
  return {
    simSourceHash: simSourceHash(simSources),
    dataHash: dataHash >>> 0,
    scenarioHash: simSourceHash(scenarioSources),
  };
}

/** Format 1 files keep their commands. The writer now stamps format 2. */
export function migrateReplay(replay: ReplayFile): ReplayFile {
  if (replay.replayFormat !== LEGACY_REPLAY_FORMAT) return replay;
  return {
    ...replay,
    replayFormat: REPLAY_FORMAT,
    versionHash: versionHash(REPLAY_FORMAT, replay.simSourceHash, replay.dataHash),
  };
}

function formatAccepted(format: number): boolean {
  return format === REPLAY_FORMAT || format === LEGACY_REPLAY_FORMAT;
}

function staleDetail(replay: ReplayFile, runtime: RuntimeStamp): { parts: string[]; detail: string } {
  const stamped = formatAccepted(replay.replayFormat) ? replay.replayFormat : REPLAY_FORMAT;
  const runtimeVersion = versionHash(stamped, runtime.simSourceHash, runtime.dataHash);
  const rows: readonly (readonly [string, number, number])[] = [
    ['replayFormat', formatAccepted(replay.replayFormat) ? stamped : replay.replayFormat, stamped],
    ['simSourceHash', replay.simSourceHash, runtime.simSourceHash],
    ['dataHash', replay.dataHash, runtime.dataHash],
    ['versionHash', replay.versionHash, runtimeVersion],
    ['scenarioHash', replay.scenarioHash, runtime.scenarioHash],
  ];
  const parts: string[] = [];
  const lines: string[] = ['refusing to play; version stamp does not match this build'];
  for (const [name, fileValue, runtimeValue] of rows) {
    const mismatching = (fileValue >>> 0) !== (runtimeValue >>> 0);
    if (mismatching) parts.push(name);
    lines.push(
      `${name} file ${hex32(fileValue)} runtime ${hex32(runtimeValue)}${mismatching ? ' MISMATCH' : ''}`,
    );
  }
  return { parts, detail: lines.join('\n') };
}

/**
 * Play a decoded replay.
 * `runtime` null skips the on-disk source hashes (browsers cannot read the tree)
 * and still checks the file's own versionHash and the per-tick samples.
 */
export function playReplay(replay: ReplayFile, scenario: Scenario, runtime: RuntimeStamp | null): PlayResult {
  if (!formatAccepted(replay.replayFormat)) {
    return fail(
      'stale',
      `unsupported replayFormat ${String(replay.replayFormat)} (this build plays ${String(REPLAY_FORMAT)})`,
      [],
      { staleParts: ['replayFormat'] },
    );
  }
  const combined = versionHash(replay.replayFormat, replay.simSourceHash, replay.dataHash);
  if (combined !== replay.versionHash) {
    return fail('format', 'versionHash does not match the stored simSourceHash and dataHash', []);
  }
  if (replay.scenarioId !== scenario.id) {
    return fail('format', `scenario id ${replay.scenarioId} does not match ${scenario.id}`, []);
  }
  if (runtime) {
    const stale = staleDetail(replay, runtime);
    if (stale.parts.length > 0) return fail('stale', stale.detail, [], { staleParts: stale.parts });
  }
  let sim: Sim;
  try {
    sim = scenario.create(replay.seed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create';
    return fail('error', message, []);
  }
  const fresh = sim.stateHash();
  try {
    sim.restore(replay.snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'restore';
    return fail('format', `snapshot restore: ${message}`, []);
  }
  const restored = sim.stateHash();
  const hashes: HashSample[] = [];
  const tick0Events = hashEvents([]);
  pushSample(hashes, 0, restored, tick0Events);
  if (fresh !== restored) {
    const divergence: Divergence = {
      tick: 0,
      stateExpected: fresh,
      stateActual: restored,
      eventExpected: tick0Events,
      eventActual: tick0Events,
    };
    return fail('divergence', 'tick 0 snapshot does not match a fresh scenario build', hashes, { divergence });
  }
  const samples = replay.hashes;
  let sampleIndex = 0;
  const tick0 = samples[0];
  if (!tick0 || tick0.tick !== 0) return fail('format', 'missing tick 0 hash', hashes);
  const at0 = mismatch(tick0, restored, tick0Events);
  if (at0) return fail('divergence', mismatchDetail(at0), hashes, { divergence: at0 });
  sampleIndex = 1;
  for (let tick = 1; tick <= replay.tickCount; tick++) {
    let stateHash = 0;
    let eventHash = 0;
    try {
      const result = sim.step(commandsForTick(replay.commands, tick));
      stateHash = result.hash;
      eventHash = result.eventHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'step';
      const divergence: Divergence = {
        tick,
        stateExpected: 0,
        stateActual: 0,
        eventExpected: 0,
        eventActual: 0,
      };
      return fail('error', `tick ${String(tick)}: ${message}`, hashes, { divergence });
    }
    pushSample(hashes, tick, stateHash, eventHash);
    const sample = samples[sampleIndex];
    if (sample && sample.tick === tick) {
      const diff = mismatch(sample, stateHash, eventHash);
      if (diff) return fail('divergence', mismatchDetail(diff), hashes, { divergence: diff });
      sampleIndex += 1;
    }
  }
  if (sampleIndex !== samples.length) return fail('format', 'hash samples left unread', hashes);
  return { ok: true, kind: 'ok', detail: '', hashes };
}
