import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EMPTY_GAME_DATABASE } from '../core/database.ts';
import { LEGACY_REPLAY_FORMAT, REPLAY_FORMAT, simSourceHash, versionHash } from '../core/version.ts';
import { decodeReplay, encodeReplay, roundTripSnapshot, sampleTicks } from './format.ts';
import { checkBytes, checkCorpus, loadSimSources, recordScript } from './node-corpus.ts';
import { migrateReplay } from './playback.ts';
import { aiRegen, aiRegenScript } from './scenarios/ai-regen.ts';
import { CORPUS } from './scenarios/index.ts';
import { idleRngScript } from './scenarios/idle-rng.ts';
import { scriptedDuelScript } from './scenarios/scripted-duel.ts';
import { listSimSourcePaths } from './sources.ts';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const corpusDir = join(root, 'replays');

function reports(result: { rows: readonly { report: string }[] }): string {
  return result.rows.map((row) => row.report).join('\n');
}

describe('replay corpus', () => {
  it('migrates a format 1 file onto format 2 without changing its commands', () => {
    const decoded = decodeReplay(readFileSync(join(corpusDir, 'idle-rng.s2replay')));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const legacy = {
      ...decoded.replay,
      replayFormat: LEGACY_REPLAY_FORMAT,
      versionHash: versionHash(LEGACY_REPLAY_FORMAT, decoded.replay.simSourceHash, decoded.replay.dataHash),
    };
    const migrated = migrateReplay(legacy);
    expect(migrated.replayFormat).toBe(REPLAY_FORMAT);
    expect(migrated.commands).toEqual(legacy.commands);
    expect(migrated.snapshot).toEqual(legacy.snapshot);
    expect(migrated.versionHash).toBe(versionHash(REPLAY_FORMAT, legacy.simSourceHash, legacy.dataHash));
  });

  it('samples tick 0, every period, and the final tick', () => {
    expect(sampleTicks(5, 2)).toEqual([0, 2, 4, 5]);
    expect(sampleTicks(4, 1)).toEqual([0, 1, 2, 3, 4]);
  });

  it('hashes sim sources only, so a doc or a replay script is not part of versionHash', () => {
    const paths = listSimSourcePaths(root);
    expect(paths).toContain('engine/core/fx.ts');
    expect(paths).toContain('engine/core/version.ts');
    expect(paths).toContain('engine/sim/sim.ts');
    for (const path of paths) {
      expect(path.startsWith('engine/core/') || path.startsWith('engine/sim/')).toBe(true);
      expect(path.endsWith('.test.ts')).toBe(false);
      expect(path.startsWith('engine/replay/')).toBe(false);
      expect(path.startsWith('docs/')).toBe(false);
    }
    const files = loadSimSources(root);
    const hash = simSourceHash(files);
    const edited = files.map((file) => {
      if (file.path !== 'engine/core/fx.ts') return file;
      const bytes = new Uint8Array(file.bytes);
      bytes[0] = bytes[0]! ^ 0xff;
      return { path: file.path, bytes };
    });
    expect(simSourceHash(edited)).not.toBe(hash);
    expect(versionHash(REPLAY_FORMAT, hash, EMPTY_GAME_DATABASE.dataHash)).not.toBe(
      versionHash(REPLAY_FORMAT, simSourceHash(edited), EMPTY_GAME_DATABASE.dataHash),
    );
  });

  it('matches the committed files byte for byte and plays them', () => {
    const result = checkCorpus(root, corpusDir);
    expect(result.ok, reports(result)).toBe(true);
    for (const script of CORPUS) {
      const encoded = encodeReplay(recordScript(root, script));
      const onDisk = new Uint8Array(readFileSync(join(corpusDir, script.fileName)));
      expect(encoded, script.fileName).toEqual(onDisk);
    }
  });

  it('sorts the player log, leaves AI commands out of the file, and round-trips a queued snapshot', () => {
    const forward = encodeReplay(recordScript(root, scriptedDuelScript));
    const backward = encodeReplay(
      recordScript(root, {
        ...scriptedDuelScript,
        commands: scriptedDuelScript.commands.slice().reverse(),
      }),
    );
    expect(backward).toEqual(forward);
    const decoded = decodeReplay(forward);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(() => encodeReplay({ ...decoded.replay, commands: decoded.replay.commands.slice().reverse() })).toThrow(
      /canonical/,
    );

    const ai = decodeReplay(encodeReplay(recordScript(root, aiRegenScript)));
    expect(ai.ok).toBe(true);
    if (!ai.ok) return;
    expect(ai.replay.commands).toHaveLength(0);
    expect(ai.replay.hashes[0]!.stateHash).not.toBe(ai.replay.hashes[ai.replay.hashes.length - 1]!.stateHash);
    expect(ai.replay.hashes.map((sample) => sample.tick)).toEqual(sampleTicks(aiRegenScript.ticks, 1));

    const sim = aiRegen.create(aiRegenScript.seed);
    sim.step([]);
    expect(sim.snapshot().queued).toHaveLength(1);
    const resumed = aiRegen.create(aiRegenScript.seed);
    resumed.restore(roundTripSnapshot(sim.snapshot()));
    expect(resumed.stateHash()).toBe(sim.stateHash());
    expect(resumed.step([]).hash).toBe(sim.step([]).hash);
  });

  it('reports the first divergent tick and refuses a stale source hash', () => {
    const script = scriptedDuelScript;
    const encoded = encodeReplay(recordScript(root, script));
    const decoded = decodeReplay(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const flipped = decoded.replay.hashes.map((sample, index) =>
      index === 4 ? { ...sample, stateHash: (sample.stateHash ^ 0x1) >>> 0 } : sample,
    );
    const diverged = encodeReplay({ ...decoded.replay, hashes: flipped });
    const divergence = checkBytes(root, `replays/${script.fileName}`, script, diverged);
    expect(divergence.ok).toBe(false);
    expect(divergence.kind).toBe('divergence');
    expect(divergence.report).toContain('first divergent tick: 4');
    expect(divergence.report).toContain('scenario: scripted-duel');
    expect(divergence.report).toContain('stateHash mismatch');

    const staleHash = (decoded.replay.simSourceHash ^ 0x1) >>> 0;
    const stale = encodeReplay({
      ...decoded.replay,
      simSourceHash: staleHash,
      versionHash: versionHash(REPLAY_FORMAT, staleHash, decoded.replay.dataHash),
    });
    const refused = checkBytes(root, `replays/${script.fileName}`, script, stale);
    expect(refused.kind).toBe('stale');
    expect(refused.report).toContain('simSourceHash');
    expect(refused.report).toContain('MISMATCH');
    expect(refused.report).not.toContain('first divergent tick');

    const staleScenario = encodeReplay({
      ...decoded.replay,
      scenarioHash: (decoded.replay.scenarioHash ^ 0x1) >>> 0,
    });
    const scenarioRefused = checkBytes(root, `replays/${script.fileName}`, script, staleScenario);
    expect(scenarioRefused.kind).toBe('stale');
    expect(scenarioRefused.report).toContain('scenarioHash');
    expect(scenarioRefused.hashes).toHaveLength(0);

    const staleData = encodeReplay({
      ...decoded.replay,
      dataHash: 1,
      versionHash: versionHash(REPLAY_FORMAT, decoded.replay.simSourceHash, 1),
    });
    const dataRefused = checkBytes(root, `replays/${script.fileName}`, script, staleData);
    expect(dataRefused.report).toContain('dataHash');
    expect(dataRefused.report).toContain('MISMATCH');
  });

  it('plays a coarser hash period and names the sampled tick', () => {
    const script = { ...idleRngScript, hashPeriod: 2, fileName: 'period.s2replay' };
    const replay = recordScript(root, script);
    const decoded = decodeReplay(encodeReplay(replay));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.replay.hashes.map((sample) => sample.tick)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    const played = checkBytes(root, 'period.s2replay', script, encodeReplay(replay));
    expect(played.ok, played.report).toBe(true);
    const index = decoded.replay.hashes.findIndex((sample) => sample.tick === 4);
    const flipped = decoded.replay.hashes.map((sample, i) =>
      i === index ? { ...sample, stateHash: (sample.stateHash ^ 0x1) >>> 0 } : sample,
    );
    const divergence = checkBytes(
      root,
      'period.s2replay',
      script,
      encodeReplay({ ...decoded.replay, hashes: flipped }),
    );
    expect(divergence.report).toContain('first divergent tick: 4');
  });

  it('the check CLI exits 0 on the corpus', () => {
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'engine/replay/cli.ts', 'check', 'replays'],
      { cwd: root, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('OK replays/idle-rng.s2replay');
    expect(result.stdout).toContain('OK replays/scripted-duel.s2replay');
    expect(result.stdout).toContain('OK replays/ai-regen.s2replay');
    expect(result.stdout).toContain('OK replays/every-empire.s2replay');
    expect(result.stdout).toContain('OK replays/heading-order.s2replay');
  });

  it('the check CLI names the first divergent tick for a tampered file', () => {
    const decoded = decodeReplay(encodeReplay(recordScript(root, idleRngScript)));
    if (!decoded.ok) throw new Error(decoded.error);
    const flipped = decoded.replay.hashes.map((sample, index) =>
      index === 1 ? { ...sample, eventHash: (sample.eventHash ^ 0xff) >>> 0 } : sample,
    );
    const dir = mkdtempSync(join(tmpdir(), 'sfc2-replay-'));
    try {
      for (const script of CORPUS) {
        const bytes =
          script.fileName === idleRngScript.fileName
            ? encodeReplay({ ...decoded.replay, hashes: flipped })
            : encodeReplay(recordScript(root, script));
        writeFileSync(join(dir, script.fileName), bytes);
      }
      const result = spawnSync(
        process.execPath,
        ['--experimental-strip-types', 'engine/replay/cli.ts', 'check', dir],
        { cwd: root, encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('first divergent tick: 1');
      expect(result.stderr).toContain('eventHash mismatch');
      expect(result.stderr).toContain('scenario: idle-rng');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
