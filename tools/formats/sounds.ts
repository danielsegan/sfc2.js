/**
 * parseSounds — docs/formats/sounds.md.
 *
 * A pure reader for the sound index. Values stay in file units.
 * Filenames that are not install-relative are dropped. The path is
 * not copied into the diagnostic.
 */

import { makeDiagnostic, type Diagnostic, type ParseResult } from "./diagnostics.ts";
import { installRelativeFile } from "./src/diagnostic.ts";
import { decodeSpecText, normalizeInstallPath, parseNumberCell } from "./text.ts";

export const SOUND_FILE_TYPES = ["wave", "pcm22k16s", "pcm22k16m"] as const;

export interface SoundClass {
  line: number;
  name: string;
  id: number | null;
  maxAtOnce: number | null;
  /** Blank and unknown words become `any` (higher or equal may preempt). */
  preempt: "never" | "higherOnly" | "lowerOnly" | "any";
  minIntervalSeconds: number | null;
  extra: string[];
}

export interface SoundEntry {
  line: number;
  /** File-type token as written, for example `wave`. */
  fileType: string;
  identifier: string | null;
  /** Install-relative, forward slashes. Null when missing or rejected. */
  filename: string | null;
  description: string | null;
  spatial: "normal" | "dolby" | "3d";
  compress: number | null;
  randomIndex: number | null;
  nextInSequence: number | null;
  other: string | null;
  loop: boolean;
  streamOnIndex: number | null;
  depth: number | null;
  loadGroups: number[];
  index: number | null;
  loadThresholds: number[];
  loadOnDemand: boolean;
  priority: number | null;
  classes: string[];
  minFreq: number | null;
  maxFreq: number | null;
  minVolume: number | null;
  maxVolume: number | null;
  minDelayMs: number | null;
  maxDelayMs: number | null;
  done: boolean | null;
  final: boolean | null;
  extra: string[];
  raw: string[];
}

export interface SoundIndex {
  header: string[] | null;
  classes: SoundClass[];
  entries: SoundEntry[];
}

export interface SoundParseOptions {
  /** Install-relative path of the index, for diagnostics. */
  file?: string;
}

const KEYWORDS = new Set(["class", "format", "wave", "pcm22k16s", "pcm22k16m"]);

export function parseSounds(input: ArrayBuffer | Uint8Array | string, options?: SoundParseOptions): ParseResult<SoundIndex> {
  const file = options?.file ? normalizeInstallPath(options.file) : undefined;
  const text = decodeSpecText(input);
  if (text.trim() === "") {
    return { data: emptyIndex(), diagnostics: [makeDiagnostic("emptyFile", "sounds", "error", file, undefined)] };
  }
  const diagnostics: Diagnostic[] = [];
  const data = emptyIndex();
  const lines = text.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const cells = splitRow(lines[i] ?? "");
    if (!cells) continue;
    const kind = (cells[0] ?? "").trim().toLowerCase();
    if (kind === "" || kind === "format") {
      if (kind === "format") data.header = cells.slice(1);
      continue;
    }
    if (kind === "class") {
      data.classes.push(readClass(cells, lineNo, file, diagnostics));
      continue;
    }
    data.entries.push(readEntry(cells, lineNo, file, diagnostics));
  }
  noteDuplicates(data, file, diagnostics);
  return { data, diagnostics };
}

function emptyIndex(): SoundIndex {
  return { header: null, classes: [], entries: [] };
}

/** Tab rows keep empty columns. A line with no tab is a comment unless it starts with a known word. */
function splitRow(line: string): string[] | null {
  if (line.includes("\t")) return line.split("\t").map(unquote);
  const trimmed = line.trim();
  if (trimmed === "") return null;
  const first = trimmed.split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  if (!KEYWORDS.has(first)) return null;
  return trimmed.split(/\s{2,}/).map(unquote);
}

function unquote(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function readClass(cells: string[], line: number, file: string | undefined, diagnostics: Diagnostic[]): SoundClass {
  const name = cells[1] ?? "";
  const id = numberCell(cells[2] ?? "", "id", line, file, diagnostics);
  const maxAtOnce = numberCell(cells[3] ?? "", "maxAtOnce", line, file, diagnostics);
  const interval = numberCell(cells[5] ?? "", "minIntervalSeconds", line, file, diagnostics);
  const preempt = preemptOf(cells[4] ?? "", line, file, diagnostics);
  return {
    line,
    name,
    id,
    maxAtOnce,
    preempt,
    minIntervalSeconds: interval,
    extra: cells.slice(6),
  };
}

function readEntry(cells: string[], line: number, file: string | undefined, diagnostics: Diagnostic[]): SoundEntry {
  const filename = filenameOf(cells[2] ?? "", cells[1] ?? "", line, file, diagnostics);
  const at = (index: number) => cells[index] ?? "";
  return {
    line,
    fileType: cells[0] ?? "",
    identifier: emptyToNull(at(1)),
    filename,
    description: emptyToNull(at(3)),
    spatial: spatialOf(at(4)),
    compress: numberCell(at(5), "compress", line, file, diagnostics),
    randomIndex: numberCell(at(6), "randomIndex", line, file, diagnostics),
    nextInSequence: numberCell(at(7), "nextInSequence", line, file, diagnostics),
    other: emptyToNull(at(8)),
    loop: flag(at(9)) === true,
    streamOnIndex: numberCell(at(10), "streamOnIndex", line, file, diagnostics),
    depth: numberCell(at(11), "depth", line, file, diagnostics),
    loadGroups: numberList(at(12), "loadGroups", line, file, diagnostics),
    index: numberCell(at(13), "index", line, file, diagnostics),
    loadThresholds: numberList(at(14), "loadThreshold", line, file, diagnostics),
    loadOnDemand: flag(at(15)) === true,
    priority: numberCell(at(16), "priority", line, file, diagnostics),
    classes: classList(at(17)),
    minFreq: numberCell(at(18), "minFreq", line, file, diagnostics),
    maxFreq: numberCell(at(19), "maxFreq", line, file, diagnostics),
    minVolume: numberCell(at(20), "minVolume", line, file, diagnostics),
    maxVolume: numberCell(at(21), "maxVolume", line, file, diagnostics),
    minDelayMs: numberCell(at(22), "minDelayMs", line, file, diagnostics),
    maxDelayMs: numberCell(at(23), "maxDelayMs", line, file, diagnostics),
    done: flag(at(24)),
    final: flag(at(25)),
    extra: cells.slice(26),
    raw: cells,
  };
}

function filenameOf(raw: string, identifier: string, line: number, file: string | undefined, diagnostics: Diagnostic[]): string | null {
  if (raw === "") {
    diagnostics.push(makeDiagnostic("missingFilename", "sounds", "warning", file, { line, field: "filename" }, identifier ? { identifier } : undefined));
    return null;
  }
  const slashed = raw.replace(/\\/g, "/");
  const safe = installRelativeFile(slashed);
  if (safe === undefined) {
    diagnostics.push(makeDiagnostic("pathRejected", "sounds", "warning", file, { line, field: "filename" }, { reason: "filename" }));
    return null;
  }
  return safe;
}

function numberCell(raw: string, field: string, line: number, file: string | undefined, diagnostics: Diagnostic[]): number | null {
  const parsed = parseNumberCell(raw);
  if (parsed.kind === "empty") return null;
  if (parsed.kind === "bad") {
    diagnostics.push(makeDiagnostic("badNumber", "sounds", "warning", file, { line, field }, safeDetails(raw)));
    return null;
  }
  return parsed.value;
}

function numberList(raw: string, field: string, line: number, file: string | undefined, diagnostics: Diagnostic[]): number[] {
  if (raw === "") return [];
  const out: number[] = [];
  for (const part of raw.split(",")) {
    const parsed = parseNumberCell(part);
    if (parsed.kind === "empty") continue;
    if (parsed.kind === "bad") {
      diagnostics.push(makeDiagnostic("badNumber", "sounds", "warning", file, { line, field }, safeDetails(part)));
      continue;
    }
    out.push(parsed.value);
  }
  return out;
}

function preemptOf(raw: string, line: number, file: string | undefined, diagnostics: Diagnostic[]): SoundClass["preempt"] {
  const text = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (text === "" || text === "any") return "any";
  if (text === "never") return "never";
  if (text === "higher only") return "higherOnly";
  if (text === "lower only") return "lowerOnly";
  diagnostics.push(makeDiagnostic("unknownPreempt", "sounds", "warning", file, { line, field: "preempt" }, safeDetails(raw)));
  return "any";
}

function spatialOf(raw: string): SoundEntry["spatial"] {
  const first = raw.trim().toLowerCase()[0];
  if (first === "d") return "dolby";
  if (first === "3") return "3d";
  return "normal";
}

function flag(raw: string): boolean | null {
  const first = raw.trim().toLowerCase()[0];
  if (first === "y") return true;
  if (first === "n") return false;
  if (raw.trim() === "") return null;
  return null;
}

function classList(raw: string): string[] {
  if (raw === "") return [];
  return raw.split(/[,;]/).map((part) => part.trim()).filter((part) => part.length > 0);
}

function emptyToNull(raw: string): string | null {
  return raw === "" ? null : raw;
}

function safeDetails(raw: string): { value: string } | undefined {
  const value = raw.trim();
  if (value.length === 0 || value.length > 32) return undefined;
  if (/[/\\:]/.test(value)) return undefined;
  return { value };
}

function noteDuplicates(data: SoundIndex, file: string | undefined, diagnostics: Diagnostic[]): void {
  const classIds = new Set<number>();
  for (const row of data.classes) {
    if (row.id === null) continue;
    if (classIds.has(row.id)) {
      diagnostics.push(makeDiagnostic("duplicateClassId", "sounds", "warning", file, { line: row.line, field: "id" }, { id: row.id }));
    }
    classIds.add(row.id);
  }
  const seen = new Map<string, number>();
  for (const entry of data.entries) {
    if (entry.index === null) continue;
    const threshold = entry.loadThresholds.length === 0 ? "" : entry.loadThresholds.join(",");
    const key = `${String(entry.index)}|${threshold}`;
    const first = seen.get(key);
    if (first !== undefined) {
      diagnostics.push(makeDiagnostic("duplicateIndex", "sounds", "warning", file, { line: entry.line, field: "index" }, { index: entry.index }));
    } else {
      seen.set(key, entry.line);
    }
  }
}
