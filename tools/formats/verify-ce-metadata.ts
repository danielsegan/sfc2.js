/**
 * Metadata-only check of a local CE install's shiplist and ftrlist.
 * Stdout is counts, pass/fail, and diagnostic classes.
 * The full report (paths, hashes, header names, weapon codes) is written
 * only when --output is set. Never prints a data row.
 *
 *   node --experimental-strip-types tools/formats/verify-ce-metadata.ts \
 *     --extracted /srv/sfc2/extracted/2.670 \
 *     --output docs/formats/inventory/parser-ce-2.670.json
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Diagnostic } from "./diagnostics.ts";
import { parseFtrlist } from "./ftrlist.ts";
import { parseShiplist } from "./shiplist.ts";
import { normHeader } from "./text.ts";
import { FTR_NUMBER_ALIASES, FTR_STRING_ALIASES, SHIP_NUMBER_ALIASES, SHIP_STRING_ALIASES } from "./tokens.ts";

interface FoundFile {
  absolute: string;
  relative: string;
  bytes: Buffer;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function walk(dir: string, root: string, hits: FoundFile[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, root, hits);
      continue;
    }
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (lower !== "shiplist.txt" && lower !== "ftrlist.txt") continue;
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    hits.push({ absolute, relative, bytes: fs.readFileSync(absolute) });
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function tally(diagnostics: Diagnostic[]): {
  counts: Record<string, number>;
  unknownWeapons: string[];
  unknownArcs: string[];
} {
  const counts: Record<string, number> = {};
  const unknownWeapons = new Set<string>();
  const unknownArcs = new Set<string>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.source}:${diagnostic.code}:${diagnostic.severity}`;
    counts[key] = (counts[key] ?? 0) + 1;
    const code = diagnostic.details?.code;
    if (typeof code !== "string") continue;
    if (diagnostic.code === "unknownWeapon") unknownWeapons.add(code);
    if (diagnostic.code === "unknownArc") unknownArcs.add(code);
  }
  return {
    counts,
    unknownWeapons: [...unknownWeapons].sort(),
    unknownArcs: [...unknownArcs].sort(),
  };
}

function boundRoles(headers: string[], aliases: Record<string, string>[]): string[] {
  const roles = new Set<string>();
  for (const header of headers) {
    const norm = normHeader(header);
    for (const table of aliases) {
      const role = table[norm];
      if (role) roles.add(role);
    }
  }
  return [...roles].sort();
}

function preferSpecs(files: FoundFile[]): FoundFile | undefined {
  return (
    files.find((file) => /\/specs\//i.test(`/${file.relative}`)) ??
    files[0]
  );
}

function summarizeShip(file: FoundFile, copies: FoundFile[]): Record<string, unknown> {
  const parsed = parseShiplist(file.bytes, { file: file.relative });
  const weapons = new Set<string>();
  let filled = 0;
  for (const row of parsed.data.rows) {
    for (const slot of row.hardpoints) {
      if (slot.weapon == null) continue;
      filled += 1;
      weapons.add(slot.weapon);
    }
  }
  const hashes = [...new Set(copies.map((copy) => sha256(copy.bytes)))];
  return {
    source: file.relative,
    bytes: file.bytes.length,
    sha256: sha256(file.bytes),
    copies: copies.map((copy) => ({ path: copy.relative, bytes: copy.bytes.length, sha256: sha256(copy.bytes) })),
    copiesIdentical: hashes.length === 1,
    columnCount: parsed.data.columns.length,
    headerNames: parsed.data.columns,
    headerRowCount: parsed.data.headerRows.length,
    rowCount: parsed.data.rows.length,
    boundRoles: boundRoles(parsed.data.columns, [SHIP_STRING_ALIASES, SHIP_NUMBER_ALIASES]),
    filledHardpoints: filled,
    weaponCodes: [...weapons].sort(),
    ...tally(parsed.diagnostics),
  };
}

function summarizeFighter(file: FoundFile, copies: FoundFile[]): Record<string, unknown> {
  const parsed = parseFtrlist(file.bytes, { file: file.relative });
  const weapons = new Set<string>();
  let filled = 0;
  for (const row of parsed.data.rows) {
    for (const slot of row.weapons) {
      if (slot.weapon == null) continue;
      filled += 1;
      weapons.add(slot.weapon);
    }
  }
  const hashes = [...new Set(copies.map((copy) => sha256(copy.bytes)))];
  return {
    source: file.relative,
    bytes: file.bytes.length,
    sha256: sha256(file.bytes),
    copies: copies.map((copy) => ({ path: copy.relative, bytes: copy.bytes.length, sha256: sha256(copy.bytes) })),
    copiesIdentical: hashes.length === 1,
    columnCount: parsed.data.columns.length,
    headerNames: parsed.data.columns,
    headerRowCount: parsed.data.headerRows.length,
    rowCount: parsed.data.rows.length,
    boundRoles: boundRoles(parsed.data.columns, [FTR_STRING_ALIASES, FTR_NUMBER_ALIASES]),
    filledWeapons: filled,
    weaponCodes: [...weapons].sort(),
    ...tally(parsed.diagnostics),
  };
}

export interface ParserTableSummary {
  rows: number;
  columns: number;
  copies: number;
  copiesIdentical: boolean;
  errors: Array<{ class: string; count: number }>;
}

export interface ParserPublicSummary {
  result: "pass" | "fail";
  shiplist: ParserTableSummary | null;
  ftrlist: ParserTableSummary | null;
}

export function publicParserSummary(report: {
  shiplist: Record<string, unknown> | null;
  ftrlist: Record<string, unknown> | null;
}): ParserPublicSummary {
  const shiplist = tableSummary(report.shiplist);
  const ftrlist = tableSummary(report.ftrlist);
  const failed =
    shiplist === null ||
    ftrlist === null ||
    shiplist.errors.some((item) => item.class.endsWith(":error")) ||
    ftrlist.errors.some((item) => item.class.endsWith(":error"));
  return { result: failed ? "fail" : "pass", shiplist, ftrlist };
}

function tableSummary(table: Record<string, unknown> | null): ParserTableSummary | null {
  if (table === null) return null;
  const counts = table.counts;
  const errors: Array<{ class: string; count: number }> = [];
  if (counts !== null && typeof counts === "object") {
    const merged = new Map<string, number>();
    for (const [key, count] of Object.entries(counts as Record<string, number>)) {
      const parts = key.split(":");
      const code = parts.length >= 2 ? parts[1] : key;
      const severity = parts.length >= 3 ? parts[2] : "info";
      const cls = `${code}:${severity}`;
      merged.set(cls, (merged.get(cls) ?? 0) + count);
    }
    for (const [cls, count] of [...merged.entries()].sort(([left], [right]) => (left < right ? -1 : 1))) {
      errors.push({ class: cls, count });
    }
  }
  return {
    rows: typeof table.rowCount === "number" ? table.rowCount : 0,
    columns: typeof table.columnCount === "number" ? table.columnCount : 0,
    copies: Array.isArray(table.copies) ? table.copies.length : 0,
    copiesIdentical: table.copiesIdentical === true,
    errors,
  };
}

export function formatParserSummary(summary: ParserPublicSummary): string {
  const ship = summary.shiplist;
  const fighter = summary.ftrlist;
  const lines = [
    `parser result=${summary.result} shiplistRows=${ship?.rows ?? 0} shiplistColumns=${ship?.columns ?? 0} shiplistCopies=${ship?.copies ?? 0} ftrlistRows=${fighter?.rows ?? 0} ftrlistColumns=${fighter?.columns ?? 0} ftrlistCopies=${fighter?.copies ?? 0}`,
  ];
  const errors = [...(ship?.errors ?? []), ...(fighter?.errors ?? [])];
  if (errors.length === 0) lines.push("parser errors=0");
  for (const item of errors) lines.push(`parser class=${item.class} count=${item.count}`);
  if (ship === null) lines.push("parser class=missing-shiplist count=1");
  if (fighter === null) lines.push("parser class=missing-ftrlist count=1");
  return lines.join("\n");
}

function run(): number {
  const extracted = arg("--extracted");
  const output = arg("--output");
  const summaryOut = arg("--summary-out");
  if (!extracted) {
    process.stderr.write("parser result=fail class=usage count=1\n");
    return 2;
  }

  const root = path.resolve(extracted);
  const found: FoundFile[] = [];
  walk(root, root, found);
  found.sort((left, right) => (left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0));
  const ships = found.filter((file) => file.relative.toLowerCase().endsWith("shiplist.txt"));
  const fighters = found.filter((file) => file.relative.toLowerCase().endsWith("ftrlist.txt"));
  const ship = preferSpecs(ships);
  const fighter = preferSpecs(fighters);

  const report = {
    schema: "parser-ce-metadata-1",
    shiplist: ship ? summarizeShip(ship, ships) : null,
    ftrlist: fighter ? summarizeFighter(fighter, fighters) : null,
  };
  const summary = publicParserSummary(report);
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (summaryOut) {
    fs.mkdirSync(path.dirname(path.resolve(summaryOut)), { recursive: true });
    fs.writeFileSync(summaryOut, `${JSON.stringify(summary, null, 2)}\n`);
  }
  process.stdout.write(`${formatParserSummary(summary)}\n`);
  return ship && fighter ? 0 : 1;
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  process.exitCode = run();
}
