import { mkdtempSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { devInstallUrl } from '../web/dev-install-shared.ts';
import {
  devInstallPlugin,
  handleDevInstall,
  installChild,
  listInstallFiles,
  resolveInstallRoot,
  type DevResponse,
} from '../web/dev-install-server.ts';

function response(): DevResponse & { body: Buffer; type: string } {
  const out = {
    statusCode: 200,
    type: '',
    body: Buffer.alloc(0),
    setHeader(name: string, value: string) {
      if (name === 'content-type') out.type = value;
    },
    end(chunk?: string | Uint8Array) {
      if (typeof chunk === 'string') out.body = Buffer.from(chunk);
      else if (chunk) out.body = Buffer.from(chunk);
    },
  };
  return out;
}

describe('dev install server', () => {
  it('serves a local folder in place and refuses paths that leave it', () => {
    const root = mkdtempSync(join(tmpdir(), 'sfc2-install-'));
    const outside = mkdtempSync(join(tmpdir(), 'sfc2-outside-'));
    mkdirSync(join(root, 'Assets', 'Specs'), { recursive: true });
    writeFileSync(join(root, 'Assets', 'Specs', 'shiplist.txt'), 'Race\tClass\n');
    writeFileSync(join(outside, 'secret.txt'), 'do-not-serve');
    symlinkSync(join(outside, 'secret.txt'), join(root, 'linked-secret.txt'));
    const before = readdirSync(root).sort();

    expect(resolveInstallRoot('relative/path', undefined).ok).toBe(false);
    expect(resolveInstallRoot(undefined, undefined)).toMatchObject({ ok: false, status: 404 });
    const resolved = resolveInstallRoot(undefined, root);
    expect(resolved.ok).toBe(true);

    const listed = listInstallFiles(root);
    expect(listed.map((file) => file.path)).toEqual(['Assets/Specs/shiplist.txt']);
    expect(installChild(root, '../secret.txt')).toBeNull();
    expect(installChild(root, 'linked-secret.txt')).toBeNull();
    expect(installChild(root, 'Assets/Specs/shiplist.txt')).toBeTruthy();

    const manifest = response();
    handleDevInstall('/__dev/install/manifest', manifest, { SFC2_INSTALL: root });
    expect(manifest.statusCode).toBe(200);
    expect(JSON.parse(manifest.body.toString()) as { files: { path: string }[] }).toEqual({
      files: [{ path: 'Assets/Specs/shiplist.txt', size: Buffer.byteLength('Race\tClass\n') }],
    });

    const file = response();
    handleDevInstall('/__dev/install/file?path=Assets/Specs/shiplist.txt', file, { SFC2_INSTALL: root });
    expect(file.body.toString()).toBe('Race\tClass\n');

    const escaped = response();
    handleDevInstall('/__dev/install/file?path=../secret.txt', escaped, { SFC2_INSTALL: root });
    expect(escaped.statusCode).toBe(404);

    const query = response();
    handleDevInstall(`/__dev/install/file?root=${encodeURIComponent(root)}&path=Assets/Specs/shiplist.txt`, query, {});
    expect(query.body.toString()).toBe('Race\tClass\n');

    expect(readdirSync(root).sort()).toEqual(before);
    expect(readFileSync(join(root, 'Assets', 'Specs', 'shiplist.txt'), 'utf8')).toBe('Race\tClass\n');
    expect(devInstallPlugin().apply).toBe('serve');
    expect(devInstallUrl('manifest', root)).toContain('root=');
    expect(devInstallUrl('file', null, 'Assets/Specs/shiplist.txt')).toBe(
      '/__dev/install/file?path=Assets%2FSpecs%2Fshiplist.txt',
    );
  });
});
