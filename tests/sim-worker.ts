import { parentPort, workerData } from 'node:worker_threads';
import { createSim } from '../engine/sim/sim.ts';

interface Job {
  seed: number;
  ticks: number;
}

const job = workerData as Job;
if (!parentPort || job === null || typeof job.seed !== 'number') {
  throw new Error('sim worker requires workerData');
}

const sim = createSim({ seed: job.seed });
const hashes: number[] = [];
const eventHashes: number[] = [];
for (let i = 0; i < job.ticks; i++) {
  const result = sim.step([]);
  hashes.push(result.hash);
  eventHashes.push(result.eventHash);
}
parentPort.postMessage({ hashes, eventHashes });
