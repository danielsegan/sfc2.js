/** Shared diagnostic shape. Display text is the locale key `source.code`, not a message field. */

export type Severity = 'error' | 'warning' | 'info';

/** Add-only. `loader` is the engine data loader. `importer` is the user-install index. */
export type DiagnosticSource =
  | 'shiplist'
  | 'ftrlist'
  | 'mod'
  | 'bmp'
  | 'sprites'
  | 'sounds'
  | 'strings'
  | 'fms'
  | 'loader'
  | 'rules'
  | 'mission'
  | 'importer';

export interface DiagnosticLocation {
  /** Install-relative path, forward slashes. Never an absolute or machine-local path. */
  file?: string;
  line?: number;
  column?: number;
  field?: string;
  offset?: number;
}

export interface Diagnostic {
  code: string;
  source: DiagnosticSource;
  severity: Severity;
  details?: Record<string, unknown>;
  location?: DiagnosticLocation;
}
