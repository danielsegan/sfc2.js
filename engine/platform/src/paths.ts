/**
 * Install-relative paths use forward slashes and stay inside the
 * folder the player picked. Drive letters, UNC paths and `..` never
 * become a VFS key or a diagnostic location.
 */

export type PathRejectReason =
  | 'absolute'
  | 'parent-segment'
  | 'empty-segment'
  | 'too-long'
  | 'unsafe';

export function normalizeInstallPath(
  raw: string,
): { ok: true; path: string } | { ok: false; reason: PathRejectReason } {
  if (raw.length > 4096) return { ok: false, reason: 'too-long' };
  if (raw.length === 0 || raw.includes('\0')) return { ok: false, reason: raw.length === 0 ? 'empty-segment' : 'unsafe' };

  let path = raw.replaceAll('\\', '/');
  if (path.startsWith('//') || path.startsWith('/')) return { ok: false, reason: 'absolute' };
  if (/^[a-zA-Z]:/.test(path)) return { ok: false, reason: 'absolute' };

  while (path.startsWith('./')) path = path.slice(2);
  if (path.endsWith('/')) path = path.slice(0, -1);
  if (path.length === 0) return { ok: false, reason: 'empty-segment' };

  const segments = path.split('/');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.') return { ok: false, reason: 'empty-segment' };
    if (segment === '..') return { ok: false, reason: 'parent-segment' };
    if (segment.includes(':')) return { ok: false, reason: 'unsafe' };
  }
  return { ok: true, path };
}

export function comparePath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
