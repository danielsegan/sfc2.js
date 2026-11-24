/**
 * Shared diagnostic shape from docs/engine/diagnostics.md.
 * Codes are flat camelCase. There is no message field.
 */

export type Severity = "error" | "warning" | "info";

/** Add-only. `loader` is the engine data loader. `importer` is the user-install index. */
export type DiagnosticSource =
  | "shiplist"
  | "ftrlist"
  | "mod"
  | "bmp"
  | "sprites"
  | "sounds"
  | "strings"
  | "fms"
  | "loader"
  | "rules"
  | "mission"
  | "importer";

export interface DiagnosticLocation {
  /** Install-relative path, forward slashes, no leading slash. */
  file?: string;
  /** 1-based line number. */
  line?: number;
  /** 1-based field index in a tab-delimited row. */
  column?: number;
  /** Raw header name, when the column is known. */
  field?: string;
  /** Byte offset for binary formats. */
  offset?: number;
}

export interface Diagnostic {
  code: string;
  source: DiagnosticSource;
  severity: Severity;
  details?: Record<string, unknown>;
  location?: DiagnosticLocation;
}

export interface ParseResult<T> {
  data: T;
  diagnostics: Diagnostic[];
}

export interface ParseOptions {
  /**
   * Path of the file relative to the install root, for example
   * `Assets/Specs/shiplist.txt`. Backslashes are rewritten to `/`.
   * A leading `./` or `/` is removed. Case is kept.
   */
  file?: string;
  /**
   * When false, do not append `unknownWeapon` / `unknownArc`
   * (`source: "loader"`). Reload-count interpretation still runs.
   * Default true, until `engine/data` owns the vocabulary check.
   */
  checkVocabulary?: boolean;
}

/** File-level codes omit `location` (docs/formats shiplist §7). */
const OMIT_LOCATION = new Set(["emptyFile", "noHeader"]);

export function makeDiagnostic(
  code: string,
  source: DiagnosticSource,
  severity: Severity,
  file: string | undefined,
  location: DiagnosticLocation | undefined,
  details?: Record<string, unknown>,
): Diagnostic {
  const diagnostic: Diagnostic = { code, source, severity };
  if (details && Object.keys(details).length > 0) {
    diagnostic.details = details;
  }
  if (OMIT_LOCATION.has(code)) return diagnostic;
  const loc: DiagnosticLocation = {};
  if (file) loc.file = file;
  if (location?.line != null) loc.line = location.line;
  if (location?.column != null) loc.column = location.column;
  if (location?.field != null && location.field !== "") loc.field = location.field;
  if (location?.offset != null) loc.offset = location.offset;
  if (Object.keys(loc).length > 0) diagnostic.location = loc;
  return diagnostic;
}
