import type { ReplayFile } from './format.ts';
import { hex32 } from './hex.ts';
import type { PlayResult } from './playback.ts';

export function formatFailure(fileLabel: string, replay: ReplayFile | null, result: PlayResult): string {
  if (result.kind === 'stale') {
    return `STALE ${fileLabel}\n${result.detail}`;
  }
  if (result.kind === 'divergence' && result.divergence) {
    const d = result.divergence;
    const lines = [
      `DIVERGENCE ${fileLabel}`,
      `first divergent tick: ${String(d.tick)}`,
    ];
    if (replay) {
      lines.push(`scenario: ${replay.scenarioId}`);
      lines.push(`seed: ${hex32(replay.seed)}`);
    }
    lines.push(`stateHash expected ${hex32(d.stateExpected)} actual ${hex32(d.stateActual)}`);
    lines.push(`eventHash expected ${hex32(d.eventExpected)} actual ${hex32(d.eventActual)}`);
    lines.push(result.detail);
    return lines.join('\n');
  }
  if (result.kind === 'error' && result.divergence) {
    return `ERROR ${fileLabel}\nfirst divergent tick: ${String(result.divergence.tick)}\n${result.detail}`;
  }
  return `FAIL ${fileLabel}\n${result.detail}`;
}

export function formatOk(fileLabel: string, replay: ReplayFile): string {
  return `OK ${fileLabel} ticks=${String(replay.tickCount)} hashes=${String(replay.hashes.length)}`;
}
