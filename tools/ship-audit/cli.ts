/**
 * pnpm ship-audit
 *
 * Reads shiplist.txt from SFC2_INSTALL (or --shiplist) and prints counts only.
 * Per-hull JSON and CSV go to --out (default out/ship-audit), which is gitignored.
 */
import { readFile } from "node:fs/promises";
import { readInstallShiplist, runAudit } from "./run.ts";

interface Args {
  install?: string;
  shiplist?: string;
  harness?: string;
  hullMap?: string;
  out: string;
  tolerance: number;
  turnTolerance: number;
  help: boolean;
}

function usage(): string {
  return [
    "usage: pnpm ship-audit [--install DIR] [--shiplist FILE] [--harness results.json] [--hull-map FILE] [--out DIR] [--tolerance N] [--turn-tolerance N]",
    "SFC2_INSTALL names the CE install when --install and --shiplist are omitted.",
    "Stdout is pass/fail counts. Hull JSON and CSV stay in --out.",
  ].join("\n");
}

function take(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

function numberFlag(value: string, flag: string): number {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`${flag} must be a non-negative number`);
  return Number(value);
}

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = { out: "out/ship-audit", tolerance: 0, turnTolerance: 1, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--help" || flag === "-h") args.help = true;
    else if (flag === "--install") {
      args.install = take(argv, i, flag);
      i += 1;
    } else if (flag === "--shiplist") {
      args.shiplist = take(argv, i, flag);
      i += 1;
    } else if (flag === "--harness") {
      args.harness = take(argv, i, flag);
      i += 1;
    } else if (flag === "--hull-map") {
      args.hullMap = take(argv, i, flag);
      i += 1;
    } else if (flag === "--out") {
      args.out = take(argv, i, flag);
      i += 1;
    } else if (flag === "--tolerance") {
      args.tolerance = numberFlag(take(argv, i, flag), flag);
      i += 1;
    } else if (flag === "--turn-tolerance") {
      args.turnTolerance = numberFlag(take(argv, i, flag), flag);
      i += 1;
    } else if (flag !== undefined) throw new Error(`unknown argument ${flag}`);
  }
  return args;
}

async function readJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Error("could not read JSON input");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("could not read JSON input");
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  let text: string | Uint8Array;
  let copiesDiffer = 0;
  if (args.shiplist) {
    try {
      text = await readFile(args.shiplist);
    } catch {
      throw new Error("could not read --shiplist");
    }
  } else {
    const install = args.install ?? process.env.SFC2_INSTALL;
    if (!install) throw new Error("set SFC2_INSTALL or pass --install or --shiplist");
    const loaded = await readInstallShiplist(install);
    text = loaded.bytes;
    copiesDiffer = loaded.copiesDiffer;
  }
  const harness = args.harness ? await readJson(args.harness) : undefined;
  const hullMapRaw = args.hullMap ? await readJson(args.hullMap) : undefined;
  let hullMap: Record<string, string> | undefined;
  if (hullMapRaw !== undefined) {
    if (hullMapRaw === null || typeof hullMapRaw !== "object" || Array.isArray(hullMapRaw)) {
      throw new Error("hull map must be a JSON object");
    }
    hullMap = {};
    for (const [key, value] of Object.entries(hullMapRaw)) {
      if (typeof value !== "string") throw new Error("hull map values must be strings");
      hullMap[key] = value;
    }
  }
  const result = await runAudit({
    text,
    outDir: args.out,
    copiesDiffer,
    harness,
    hullMap,
    tolerance: args.tolerance,
    turnTolerance: args.turnTolerance,
  });
  process.stdout.write(result.text);
  return result.failed ? 1 : 0;
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("cli.ts") || entry.endsWith("cli.js")) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "ship-audit failed";
      process.stderr.write(`${message}\n`);
      process.exitCode = 2;
    },
  );
}
