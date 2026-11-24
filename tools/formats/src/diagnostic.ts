/**
 * Shared diagnostic shape from docs/engine/diagnostics.md and
 * docs/formats/README.md. Codes are flat camelCase and add-only.
 * `location.file` is a path relative to the player's install root.
 */

export const DIAGNOSTIC_SOURCES = [
  'shiplist',
  'ftrlist',
  'mod',
  'bmp',
  'sprites',
  'sounds',
  'strings',
  'fms',
  'loader',
  'rules',
  'mission',
  'importer',
] as const;

export type DiagnosticSource = (typeof DIAGNOSTIC_SOURCES)[number];

export type Severity = 'error' | 'warning' | 'info';

export interface DiagnosticLocation {
  /** Install-relative path, forward slashes. Never absolute or machine-local. */
  file?: string;
  /** 1-based line for text formats. */
  line?: number;
  /** 1-based field index for tab-delimited tables. */
  column?: number;
  /** Raw header name, when known. */
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

const DRIVE_LETTER = /^[a-zA-Z]:/;

/**
 * Accept a path that is relative to the install root.
 * Rejects drive letters, UNC paths, leading slashes, backslashes, and `..`.
 */
export function installRelativeFile(path: string): string | undefined {
  if (path.length === 0 || path.length > 4096) return undefined;
  if (path.includes('\\') || path.includes('\0')) return undefined;
  if (path.startsWith('/') || path.startsWith('//')) return undefined;
  if (DRIVE_LETTER.test(path)) return undefined;
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..' || segment.includes(':')) return undefined;
  }
  return path;
}

export function diagnostic(
  code: string,
  source: DiagnosticSource,
  severity: Severity,
  extras?: {
    details?: Record<string, unknown>;
    location?: DiagnosticLocation;
  },
): Diagnostic {
  const result: Diagnostic = { code, source, severity };
  if (extras?.details !== undefined) result.details = extras.details;
  const location = sanitizeLocation(extras?.location);
  if (location !== undefined) result.location = location;
  return result;
}

function sanitizeLocation(location: DiagnosticLocation | undefined): DiagnosticLocation | undefined {
  if (location === undefined) return undefined;
  const next: DiagnosticLocation = {};
  if (location.file !== undefined) {
    const file = installRelativeFile(location.file);
    if (file !== undefined) next.file = file;
  }
  if (location.line !== undefined) next.line = location.line;
  if (location.column !== undefined) next.column = location.column;
  if (location.field !== undefined) next.field = location.field;
  if (location.offset !== undefined) next.offset = location.offset;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Walk a diagnostic tree and return the first string that looks machine-local. */
export function machinePathLeak(value: unknown): string | null {
  for (const text of collectStrings(value)) {
    if (
      text.includes('\\') ||
      text.startsWith('/') ||
      DRIVE_LETTER.test(text) ||
      text.split('/').includes('..') ||
      text.includes('file://') ||
      text.includes('http://') ||
      text.includes('https://')
    ) {
      return text;
    }
  }
  return null;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}
