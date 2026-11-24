/** Query string for the dev-only install server. Safe to import from the browser. */

export function devInstallUrl(kind: 'manifest' | 'file', root: string | null, path?: string): string {
  const params = new URLSearchParams();
  if (root && root.length > 0) params.set('root', root);
  if (kind === 'file' && path) params.set('path', path);
  const query = params.toString();
  const base = kind === 'manifest' ? '/__dev/install/manifest' : '/__dev/install/file';
  return query.length > 0 ? `${base}?${query}` : base;
}
