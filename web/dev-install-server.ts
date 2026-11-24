/**
 * Dev-server read of a local install. `SFC2_INSTALL` or `?root=` (the page
 * passes `?install=` through as `root`). Files stay where they are. This
 * module does not copy them into the repo or into build output.
 * `apply: 'serve'` keeps the route off `vite build`.
 */
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';

export interface InstallFile {
  readonly path: string;
  readonly size: number;
}

export type InstallRoot =
  | { readonly ok: true; readonly root: string }
  | { readonly ok: false; readonly status: number; readonly error: string };

export function resolveInstallRoot(requested: string | undefined, envValue: string | undefined): InstallRoot {
  const fromQuery = requested?.trim() ?? '';
  const raw = fromQuery.length > 0 ? fromQuery : (envValue ?? '').trim();
  if (raw.length === 0) return { ok: false, status: 404, error: 'no install root' };
  if (!isAbsolute(raw)) return { ok: false, status: 400, error: 'install root must be absolute' };
  let root: string;
  try {
    root = realpathSync(raw);
  } catch {
    return { ok: false, status: 404, error: 'install root was not found' };
  }
  if (!statSync(root).isDirectory()) return { ok: false, status: 400, error: 'install root is not a directory' };
  return { ok: true, root };
}

/** Absolute file path inside root, or null when the request leaves the install. */
export function installChild(root: string, rel: string): string | null {
  if (rel.length === 0 || rel.includes('\0') || isAbsolute(rel)) return null;
  const parts = rel.split(/[/\\]/);
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return null;
  let real: string;
  try {
    real = realpathSync(resolve(root, ...parts));
  } catch {
    return null;
  }
  const fromRoot = relative(root, real);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) return null;
  if (!statSync(real).isFile()) return null;
  return real;
}

export function listInstallFiles(root: string): InstallFile[] {
  const out: InstallFile[] = [];
  walk(root, root, out);
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

function walk(root: string, dir: string, out: InstallFile[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.' || entry.name === '..') continue;
    let real: string;
    try {
      real = realpathSync(resolve(dir, entry.name));
    } catch {
      continue;
    }
    const fromRoot = relative(root, real);
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) continue;
    let info;
    try {
      info = statSync(real);
    } catch {
      continue;
    }
    if (info.isDirectory()) walk(root, real, out);
    else if (info.isFile()) out.push({ path: fromRoot.split(sep).join('/'), size: info.size });
  }
}

export interface DevResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string | Uint8Array): void;
}

export function handleDevInstall(url: string, res: DevResponse, env: { SFC2_INSTALL?: string }): void {
  const parsed = new URL(url, 'http://127.0.0.1');
  const pathname = parsed.pathname;
  if (pathname !== '/__dev/install/manifest' && pathname !== '/__dev/install/file') {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('not found');
    return;
  }
  const root = resolveInstallRoot(parsed.searchParams.get('root') ?? undefined, env.SFC2_INSTALL);
  if (!root.ok) {
    res.statusCode = root.status;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(root.error);
    return;
  }
  if (pathname.endsWith('/manifest')) {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ files: listInstallFiles(root.root) }));
    return;
  }
  const file = installChild(root.root, parsed.searchParams.get('path') ?? '');
  if (!file) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('not in the install');
    return;
  }
  res.statusCode = 200;
  res.setHeader('content-type', 'application/octet-stream');
  res.end(readFileSync(file));
}

export function devInstallMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? '';
    const pathOnly = url.split('?')[0] ?? '';
    if (!pathOnly.startsWith('/__dev/install/')) {
      next();
      return;
    }
    handleDevInstall(url, res, process.env);
  };
}

export function devInstallPlugin(): Plugin {
  return {
    name: 'sfc2-dev-install',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(devInstallMiddleware());
    },
  };
}
