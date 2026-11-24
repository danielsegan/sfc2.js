/**
 * Windows-1252 text tables. Parsers accept a string or bytes and never throw
 * on malformed contents (docs/formats README, parser conventions).
 */

import { makeDiagnostic, type Diagnostic, type DiagnosticSource } from "./diagnostics.ts";

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function isCompleteNumber(text: string): boolean {
  if (!NUMBER_RE.test(text)) return false;
  const value = Number(text);
  return Number.isFinite(value);
}

export type NumberParse =
  | { kind: "empty" }
  | { kind: "ok"; value: number }
  | { kind: "bad" };

/** Decimal with `.` as the separator. Rejects trailing junk and exponents. */
export function parseNumberCell(raw: string): NumberParse {
  const text = raw.trim();
  if (text === "") return { kind: "empty" };
  if (!isCompleteNumber(text)) return { kind: "bad" };
  return { kind: "ok", value: Number(text) };
}

export function normalizeInstallPath(file: string): string {
  let path = file.replace(/\\/g, "/");
  while (path.startsWith("./")) path = path.slice(2);
  while (path.startsWith("/")) path = path.slice(1);
  return path;
}

export function decodeSpecText(input: ArrayBuffer | Uint8Array | string): string {
  if (typeof input === "string") return stripBom(input);
  if (input instanceof Uint8Array) return decodeBytes(input);
  if (input instanceof ArrayBuffer) return decodeBytes(new Uint8Array(input));
  throw new TypeError("spec input must be a string, Uint8Array, or ArrayBuffer");
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function decodeBytes(bytes: Uint8Array): string {
  let start = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    start = 3;
  }
  return new TextDecoder("windows-1252").decode(bytes.subarray(start));
}

export interface TextLine {
  /** 1-based line in the original text. */
  line: number;
  cells: string[];
}

/** Split on LF, CRLF or CR. Drops one trailing empty line produced by a final break. */
export function splitSpecLines(text: string): string[] {
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function tableLines(text: string): TextLine[] {
  const lines = splitSpecLines(text);
  const out: TextLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    out.push({ line: i + 1, cells: lines[i].split("\t") });
  }
  return out;
}

export function normHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/_+$/g, "");
}

function isRaceHeader(cells: string[]): boolean {
  return (cells[0] ?? "").trim().toLowerCase() === "race";
}

function mostlyNonNumeric(cells: string[]): boolean {
  if (cells.length === 0) return false;
  let non = 0;
  for (const cell of cells) {
    if (!isCompleteNumber(cell.trim())) non += 1;
  }
  return non * 2 > cells.length;
}

/** A leading comment is one non-numeric cell and no tabs (ftrlist line 1, or a `<0` marker). */
function isCommentLine(cells: string[]): boolean {
  return cells.length === 1 && cells[0].trim() !== "" && !isCompleteNumber(cells[0].trim());
}

/**
 * CE 2.670 puts an instruction row on line 1: the first cell is blank, a
 * sentence sits in the second cell, and every later cell is empty.
 * That row is not the column header. Observed on sfc2-ci; the sentence is not stored here.
 */
function isInstructionLine(cells: string[]): boolean {
  if (cells.length < 2 || cells[0].trim() !== "") return false;
  const text = cells[1].trim();
  if (text === "") return false;
  if (!cells.slice(2).every((cell) => cell.trim() === "")) return false;
  return (
    text.includes(" ") ||
    text.length > 24 ||
    /do not edit|back-?up|this file contains|keep the first column blank|write a comment|instruction|synthetic fixture/i.test(
      text,
    )
  );
}

function isColumnHeader(cells: string[]): boolean {
  if (isRaceHeader(cells)) return true;
  if (cells.length < 2) return false;
  return mostlyNonNumeric(cells);
}

export function trimTrailingEmpty(cells: string[]): string[] {
  let end = cells.length;
  while (end > 0 && cells[end - 1].trim() === "") end -= 1;
  return cells.slice(0, end);
}

export interface HeaderSplit {
  /** Raw cells of each leading comment plus the column-header line. */
  headerRows: string[][];
  /** Column-header cells, or null when no header was detected. */
  columns: string[] | null;
  data: TextLine[];
  /** 1-based line of the second header row, when there is more than one. */
  multipleHeaderLine?: number;
}

/**
 * Header rule from docs/formats/shiplist.md §3.
 * A line whose first cell is `Race` is the column header. Leading single-cell
 * comments and the CE instruction row (blank first cell, sentence in the
 * second, rest empty) are kept in `headerRows` and are not column names.
 * Any other mostly non-numeric multi-cell line is the column header.
 * Lines after that header are data, even when they are mostly text.
 */
export function splitHeader(lines: TextLine[]): HeaderSplit {
  let index = 0;
  const comments: TextLine[] = [];
  while (
    index < lines.length &&
    (isCommentLine(lines[index].cells) || isInstructionLine(lines[index].cells))
  ) {
    comments.push(lines[index]);
    index += 1;
  }
  if (index < lines.length && isColumnHeader(lines[index].cells)) {
    const header = lines[index];
    const columns = trimTrailingEmpty(header.cells);
    if (columns.length > 0) {
      const headerLines = [...comments, header];
      return {
        headerRows: headerLines.map((line) => line.cells),
        columns,
        data: lines.slice(index + 1),
        multipleHeaderLine: headerLines.length > 1 ? headerLines[1].line : undefined,
      };
    }
  }
  return {
    headerRows: comments.map((line) => line.cells),
    columns: null,
    data: lines.slice(index),
  };
}

function normalizeNewlines(text: string): string {
  return stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Importer-level: the Assets/Specs copy and the MetaAssets copy differ.
 * Callers pass already-decoded text. Line endings and a leading BOM are ignored.
 */
export function compareSpecCopies(
  source: Extract<DiagnosticSource, "shiplist" | "ftrlist">,
  assetsText: string,
  metaText: string,
  file?: string,
): Diagnostic | null {
  if (typeof assetsText !== "string" || typeof metaText !== "string") {
    throw new TypeError("spec copies must be strings");
  }
  if (normalizeNewlines(assetsText) === normalizeNewlines(metaText)) return null;
  const normalized = file == null || file === "" ? undefined : normalizeInstallPath(file);
  return makeDiagnostic("specsMetaassetsDiffer", source, "warning", normalized, undefined);
}
