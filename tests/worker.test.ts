import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSim } from '../engine/sim/sim.ts';

function inWorker(seed: number, ticks: number): Promise<{ hashes: number[]; eventHashes: number[] }> {
  const harness = fileURLToPath(new URL('./sim-worker.ts', import.meta.url));
  return new Promise((resolve, reject) => {
    const worker = new Worker(harness, {
      execArgv: ['--experimental-strip-types'],
      workerData: { seed, ticks },
    });
    worker.once('message', (message: { hashes: number[]; eventHashes: number[] }) => resolve(message));
    worker.once('error', reject);
  });
}

describe('worker boundary', () => {
  it('matches the main-thread hash sequence from command bytes only', async () => {
    const ticks = 8;
    const seed = 21;
    const sim = createSim({ seed });
    const hashes: number[] = [];
    const eventHashes: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const result = sim.step([]);
      hashes.push(result.hash);
      eventHashes.push(result.eventHash);
    }
    const remote = await inWorker(seed, ticks);
    expect(remote).toEqual({ hashes, eventHashes });
  });
});
