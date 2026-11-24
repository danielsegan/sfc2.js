/**
 * Read a shiplist, derive every hull, and optionally diff a harness capture.
 * Stdout is the summary from formatSummary. Hull files go to the out directory.
 */
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseShiplist } from "../../tools/formats/shiplist.ts";
import { CE_HEADERS } from "./columns.ts";
import { auditRow, type HullAudit } from "./derive.ts";
import { diffHarness, type HarnessDiff } from "./harness.ts";
import { writeAuditOutput } from "./report.ts";
import { formatSummary, summarize, summaryFailed, type AuditSummary } from "./summary.ts";

export interface AuditRun {
  hulls: HullAudit[];
  summary: AuditSummary;
  text: string;
  failed: boolean;
}

const KNOWN = new Set(CE_HEADERS);

function rank(rel: string): number {
  const lower = rel.toLowerCase();
  if (lower.endsWith("assets/specs/shiplist.txt")) return 0;
  if (lower.endsWith("specs/shiplist.txt") && !lower.endsWith("assets/specs/shiplist.txt")) return 1;
  if (lower.endsWith("metaassets/shiplist.txt")) return 2;
  return 9;
}

async function listFiles(rootReal: string): Promise<string[]> {
  const entries = await readdir(rootReal, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const real = await realpath(absolute);
    if (real !== rootReal && !real.startsWith(`${rootReal}${path.sep}`)) continue;
    const rel = path.relative(rootReal, real).split(path.sep).join("/");
    if (rel !== "" && !rel.split("/").includes("..")) files.push(rel);
  }
  return files;
}

/** Locate shiplist.txt under an install root. Does not return the absolute path. */
export async function readInstallShiplist(root: string): Promise<{ bytes: Uint8Array; copiesDiffer: number }> {
  let rootReal: string;
  try {
    const info = await stat(root);
    if (!info.isDirectory()) throw new Error("not a directory");
    rootReal = await realpath(root);
  } catch {
    throw new Error("SFC2_INSTALL is not a readable directory");
  }
  const files = await listFiles(rootReal);
  const hits = files.filter((rel) => rank(rel) < 9).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const chosen = hits.find((rel) => rank(rel) === 0) ?? hits.find((rel) => rank(rel) === 1);
  if (!chosen) throw new Error("shiplist.txt was not found under SFC2_INSTALL");
  const bytes = await readFile(path.join(rootReal, chosen));
  const meta = hits.find((rel) => rank(rel) === 2);
  let copiesDiffer = 0;
  if (meta) {
    const other = await readFile(path.join(rootReal, meta));
    if (!bytes.equals(other)) copiesDiffer = 1;
  }
  return { bytes, copiesDiffer };
}

export function auditText(
  text: string | Uint8Array,
  options?: {
    copiesDiffer?: number;
    harness?: unknown;
    hullMap?: Readonly<Record<string, string>>;
    tolerance?: number;
    turnTolerance?: number;
  },
): { hulls: HullAudit[]; summary: AuditSummary } {
  const parsed = parseShiplist(text, { checkVocabulary: false });
  const columns = parsed.data.columns;
  const hulls = parsed.data.rows.map((row) => auditRow(row, columns));
  let harness: HarnessDiff | null = null;
  if (options?.harness !== undefined) {
    harness = diffHarness(
      hulls,
      options.harness,
      options.hullMap ?? {},
      options.tolerance ?? 0,
      options.turnTolerance ?? 1,
    );
  }
  const summary = summarize(hulls, columns, KNOWN, options?.copiesDiffer ?? 0, harness);
  return { hulls, summary };
}

export async function runAudit(options: {
  text: string | Uint8Array;
  outDir: string;
  copiesDiffer?: number;
  harness?: unknown;
  hullMap?: Readonly<Record<string, string>>;
  tolerance?: number;
  turnTolerance?: number;
}): Promise<AuditRun> {
  const { hulls, summary } = auditText(options.text, options);
  await writeAuditOutput(options.outDir, hulls, summary);
  const text = formatSummary(summary);
  return { hulls, summary, text, failed: summaryFailed(summary) };
}
