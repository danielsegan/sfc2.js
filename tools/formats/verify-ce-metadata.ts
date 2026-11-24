/**
 * Metadata-only check of a local CE install's shiplist and ftrlist.
 * Prints counts, header names, hashes, and diagnostic tallies.
 * Never prints a data row, spawn key, class name, or geometry path.
 *
 *   node --experimental-strip-types tools/formats/verify-ce-metadata.ts \
 *     --extracted /srv/sfc2/extracted/2.670 \
 *     --output docs/formats/inventory/parser-ce-2.670.json
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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

const extracted = arg("--extracted");
const output = arg("--output");
if (!extracted) {
  console.error("usage: verify-ce-metadata.ts --extracted <install-or-extracted-root> [--output <file>]");
  process.exit(2);
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

if (!ship || !fighter) {
  console.error(`missing table: shiplist=${ship ? "yes" : "no"} ftrlist=${fighter ? "yes" : "no"}`);
}

const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, text);
}
process.stdout.write(text);
if (!ship || !fighter) process.exit(1);
