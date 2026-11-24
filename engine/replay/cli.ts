import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCorpus, recordCorpus } from './node-corpus.ts';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function usage(): string {
  return [
    'usage: replay-cli check [dir]',
    '       replay-cli json [dir]',
    '       replay-cli record [dir]',
    'dir defaults to replays',
  ].join('\n');
}

function dirArg(argv: readonly string[]): string {
  const dir = argv[1] ?? 'replays';
  return resolve(root, dir);
}

const command = process.argv[2] ?? '';
const dir = dirArg(process.argv.slice(2));

if (command === 'record') {
  recordCorpus(root, dir);
  process.stdout.write(`recorded corpus in ${dir}\n`);
} else if (command === 'check' || command === 'json') {
  const result = checkCorpus(root, dir);
  if (command === 'json') {
    const payload = result.rows.map((row) => ({
      file: row.file,
      ok: row.ok,
      kind: row.kind,
      detail: row.detail,
      hashes: row.hashes.map((sample) => ({
        tick: sample.tick,
        stateHash: sample.stateHash,
        eventHash: sample.eventHash,
      })),
    }));
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    for (const row of result.rows) {
      if (row.ok) process.stdout.write(`${row.report}\n`);
      else process.stderr.write(`${row.report}\n`);
    }
  }
  if (!result.ok) process.exitCode = 1;
} else {
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 2;
}
