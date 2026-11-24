/** Shared diagnostic shape. Display text is the locale key `source.code`, not a message field. */

export type Severity = 'error' | 'warning' | 'info';

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
  | 'mission';

export interface DiagnosticLocation {
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
