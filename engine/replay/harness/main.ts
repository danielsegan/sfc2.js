import { decodeReplay } from '../format.ts';
import { playReplay } from '../playback.ts';
import { CORPUS_FILES, scenarioById } from '../scenarios/index.ts';

interface HashRow {
  tick: number;
  stateHash: number;
  eventHash: number;
}

interface BrowserRow {
  file: string;
  ok: boolean;
  kind: string;
  detail: string;
  hashes: HashRow[];
}

async function run(): Promise<void> {
  const rows: BrowserRow[] = [];
  for (const fileName of CORPUS_FILES) {
    const file = `replays/${fileName}`;
    try {
      const response = await fetch(`/replays/${fileName}`);
      if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const decoded = decodeReplay(bytes);
      if (!decoded.ok) {
        rows.push({ file, ok: false, kind: 'format', detail: decoded.error, hashes: [] });
        continue;
      }
      const scenario = scenarioById(decoded.replay.scenarioId);
      if (!scenario) {
        rows.push({ file, ok: false, kind: 'format', detail: 'unknown scenario', hashes: [] });
        continue;
      }
      const played = playReplay(decoded.replay, scenario, null);
      const hashes: HashRow[] = [];
      for (const sample of played.hashes) {
        hashes.push({ tick: sample.tick, stateHash: sample.stateHash, eventHash: sample.eventHash });
      }
      rows.push({ file, ok: played.ok, kind: played.kind, detail: played.detail, hashes });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'browser replay failed';
      rows.push({ file, ok: false, kind: 'error', detail, hashes: [] });
    }
  }
  const out = document.querySelector('#out');
  if (!out) throw new Error('missing #out');
  out.textContent = JSON.stringify(rows);
  document.body.dataset.ready = '1';
}

void run();
