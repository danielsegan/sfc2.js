/**
 * Headless check: every shiplist row loads and spins with textures and self-illum.
 *
 *   node --experimental-strip-types tools/viewer-check/cli.ts --synthetic
 *   SFC2_REFERENCE=/path/to/install node --experimental-strip-types tools/viewer-check/cli.ts
 *
 * Stdout is one JSON summary: per ship {id, empire, pass, stage_failed, error}
 * plus totals. Paths, file bytes, and pixels are not printed.
 * `--summary FILE` checks a summary that was already written and prints totals only.
 *
 * The private job is `.github/workflows/private-viewer-check.yml`.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectReport } from './report.ts';

interface Args {
  synthetic: boolean;
  install?: string;
  frames?: number;
  summary?: string;
  allowFailures: boolean;
  help: boolean;
}

function usage(): string {
  return [
    'usage: node --experimental-strip-types tools/viewer-check/cli.ts [--synthetic] [--install DIR] [--frames N]',
    '       node --experimental-strip-types tools/viewer-check/cli.ts --summary FILE [--allow-failures]',
    'SFC2_REFERENCE, then SFC2_INSTALL, names the CE install when --synthetic and --install are omitted.',
    'Stdout is the JSON summary. --summary prints totals only.',
  ].join('\n');
}

function take(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
  return value;
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { synthetic: false, allowFailures: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help' || flag === '-h') args.help = true;
    else if (flag === '--synthetic') args.synthetic = true;
    else if (flag === '--allow-failures') args.allowFailures = true;
    else if (flag === '--install') {
      args.install = take(argv, i, flag);
      i += 1;
    } else if (flag === '--summary') {
      args.summary = take(argv, i, flag);
      i += 1;
    } else if (flag === '--frames') {
      const raw = take(argv, i, flag);
      if (!/^[2-8]$/.test(raw)) throw new Error('--frames must be an integer from 2 to 8');
      args.frames = Number(raw);
      i += 1;
    } else if (flag !== undefined) throw new Error(`unknown argument ${flag}`);
  }
  return args;
}

async function summarize(file: string, allowFailures: boolean): Promise<number> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    process.stderr.write('viewer summary rejected the report (shape)\n');
    return 2;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    process.stderr.write('viewer summary rejected the report (shape)\n');
    return 2;
  }
  const inspected = inspectReport(parsed);
  if (inspected.report === null || inspected.problem === 'shape' || inspected.problem === 'leak' || inspected.problem === 'mismatch') {
    process.stderr.write(`viewer summary rejected the report (${inspected.problem ?? 'shape'})\n`);
    return 2;
  }
  if (inspected.problem === 'empty') {
    process.stderr.write('viewer summary rejected the report (empty)\n');
    return 2;
  }
  process.stdout.write(`${JSON.stringify(inspected.report.totals)}\n`);
  if (!allowFailures && inspected.report.totals.failed > 0) return 1;
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (args.summary !== undefined) return summarize(args.summary, args.allowFailures);

  const { runViewerCheck } = await import('./run.ts');
  const install = args.install ?? process.env.SFC2_REFERENCE ?? process.env.SFC2_INSTALL;
  const run = await runViewerCheck({
    synthetic: args.synthetic,
    ...(args.synthetic ? {} : { install }),
    ...(args.frames === undefined ? {} : { frames: args.frames }),
  });
  if (run.pageError !== null) process.stderr.write(`viewer page error: ${run.pageError}\n`);
  if (run.report === null || run.status === 'withheld' || run.status === 'unsafe' || run.status === 'no-report') {
    process.stderr.write(`viewer check withheld the report (${run.status})\n`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify(run.report, null, 2)}\n`);
  if (run.status === 'no-install' || run.status === 'no-webgl') return 2;
  return run.report.totals.failed === 0 ? 0 : 1;
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'viewer check failed';
      const safe = message.includes('\\') || message.includes('/srv/') ? 'viewer check failed' : message;
      process.stderr.write(`${safe}\n`);
      process.exitCode = 2;
    });
}
