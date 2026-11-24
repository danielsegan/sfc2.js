/**
 * Read a shiplist, derive every hull, and optionally diff a harness capture.
 * Stdout is the summary from formatSummary. Hull files go to the out directory.
 */
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseShiplist, type Shiplist, type ShiplistRow } from "../../tools/formats/shiplist.ts";
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

export interface CopyReport {
  differ: number;
  assetsRows: number;
  metaRows: number;
  assetsColumns: number;
  metaColumns: number;
  onlyInOne: number;
  rowsDiffer: number;
  headerNamesDiffer: number;
  columnsDiffer: number;
  note: string;
}

export const SINGLE_FILE_COPY: CopyReport = {
  differ: 0,
  assetsRows: 0,
  metaRows: 0,
  assetsColumns: 0,
  metaColumns: 0,
  onlyInOne: 0,
  rowsDiffer: 0,
  headerNamesDiffer: 0,
  columnsDiffer: 0,
  note: "not compared (one file)",
};

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

function rowIndex(rows: readonly ShiplistRow[]): Map<string, string[][]> {
  const map = new Map<string, string[][]>();
  for (const row of rows) {
    const key = row.spawnKey.toLowerCase();
    const list = map.get(key) ?? [];
    list.push(row.raw);
    map.set(key, list);
  }
  return map;
}

function sameCells(left: readonly string[], right: readonly string[]): boolean {
  const width = Math.max(left.length, right.length);
  for (let i = 0; i < width; i++) {
    if ((left[i] ?? "") !== (right[i] ?? "")) return false;
  }
  return true;
}

/** Counts only. Spawn keys stay inside this function. */
export function diffShiplistCopies(assets: Shiplist, meta: Shiplist): CopyReport {
  const left = rowIndex(assets.rows);
  const right = rowIndex(meta.rows);
  let onlyInOne = 0;
  let rowsDiffer = 0;
  const dirtyColumns = new Set<number>();
  const keys = new Set<string>([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    const a = left.get(key);
    const b = right.get(key);
    if (!a || !b) {
      onlyInOne += 1;
      continue;
    }
    let keyDiffers = a.length !== b.length;
    const shared = Math.min(a.length, b.length);
    for (let i = 0; i < shared; i++) {
      const rowA = a[i] ?? [];
      const rowB = b[i] ?? [];
      if (!sameCells(rowA, rowB)) {
        keyDiffers = true;
        const width = Math.max(rowA.length, rowB.length);
        for (let column = 0; column < width; column++) {
          if ((rowA[column] ?? "") !== (rowB[column] ?? "")) dirtyColumns.add(column);
        }
      }
    }
    if (keyDiffers) rowsDiffer += 1;
  }
  const width = Math.max(assets.columns.length, meta.columns.length);
  let headerNamesDiffer = 0;
  for (let i = 0; i < width; i++) {
    if ((assets.columns[i] ?? "") !== (meta.columns[i] ?? "")) headerNamesDiffer += 1;
  }
  const differ =
    assets.rows.length !== meta.rows.length ||
    headerNamesDiffer > 0 ||
    onlyInOne > 0 ||
    rowsDiffer > 0
      ? 1
      : 0;
  return {
    differ,
    assetsRows: assets.rows.length,
    metaRows: meta.rows.length,
    assetsColumns: assets.columns.length,
    metaColumns: meta.columns.length,
    onlyInOne,
    rowsDiffer,
    headerNamesDiffer,
    columnsDiffer: dirtyColumns.size,
    note: differ === 0 ? "assets/specs and metaassets shiplist.txt match" : "assets/specs and metaassets shiplist.txt differ",
  };
}

/** Locate shiplist.txt under an install root. Does not return the absolute path. */
export async function readInstallShiplist(root: string): Promise<{ bytes: Uint8Array; copies: CopyReport }> {
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
  if (!meta) {
    const parsed = parseShiplist(bytes, { checkVocabulary: false });
    return {
      bytes,
      copies: {
        ...SINGLE_FILE_COPY,
        assetsRows: parsed.data.rows.length,
        assetsColumns: parsed.data.columns.length,
        note: "one shiplist.txt (assets/specs); no metaassets copy",
      },
    };
  }
  const other = await readFile(path.join(rootReal, meta));
  const assets = parseShiplist(bytes, { checkVocabulary: false });
  const metaList = parseShiplist(other, { checkVocabulary: false });
  return { bytes, copies: diffShiplistCopies(assets.data, metaList.data) };
}

export function auditText(
  text: string | Uint8Array,
  options?: {
    copies?: CopyReport;
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
  const summary = summarize(hulls, columns, options?.copies ?? SINGLE_FILE_COPY, harness);
  return { hulls, summary };
}

export async function runAudit(options: {
  text: string | Uint8Array;
  outDir: string;
  copies?: CopyReport;
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
