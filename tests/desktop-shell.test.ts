import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const tauriDir = join(root, 'desktop', 'src-tauri');
const iconDir = join(tauriDir, 'icons');
const maxBytes = 1_048_576;

describe('desktop shell scaffold', () => {
  it('matches the root package version and the placeholder bundle id', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      version: string;
      scripts: Record<string, string>;
    };
    const config = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8')) as {
      productName: string;
      version: string;
      identifier: string;
      build: { frontendDist: string; devUrl: string; beforeDevCommand: string; beforeBuildCommand: string };
      bundle: { targets: string[]; icon: string[] };
    };
    const cargo = readFileSync(join(tauriDir, 'Cargo.toml'), 'utf8');
    const packageSection = cargo.split(/^\[/m).find((part) => part.startsWith('package]'));
    const cargoVersion = packageSection?.match(/^version = "([^"]+)"/m)?.[1];

    expect(pkg.scripts['desktop:dev']).toBe('pnpm exec tauri dev');
    expect(pkg.scripts['desktop:build']).toBe('pnpm exec tauri build');
    expect(config.productName).toBe('SFC2.js');
    expect(config.version).toBe(pkg.version);
    expect(cargoVersion).toBe(pkg.version);
    expect(config.identifier).toBe('io.segan.sfc2js');
    expect(config.build.frontendDist).toBe('../../web/dist');
    expect(config.build.devUrl).toBe('http://127.0.0.1:5174');
    expect(config.build.beforeDevCommand).toBe('pnpm dev:web');
    expect(config.build.beforeBuildCommand).toBe('pnpm build:web');
    expect(config.bundle.targets).toEqual(['dmg', 'app', 'msi', 'nsis', 'appimage', 'deb', 'rpm']);
    expect(JSON.stringify(config)).not.toContain('flatpak');
    expect(JSON.stringify(config)).not.toContain('updater');
    expect(JSON.stringify(config)).not.toContain('signingIdentity');
    expect(JSON.stringify(config)).not.toContain('certificateThumbprint');
    expect(cargo).not.toContain('tauri-plugin-updater');
  });

  it('grants dialog open and read-only filesystem commands, and nothing broader', () => {
    const capability = JSON.parse(
      readFileSync(join(tauriDir, 'capabilities', 'default.json'), 'utf8'),
    ) as { windows: string[]; permissions: string[] };
    expect(capability.windows).toEqual(['main']);
    expect(capability.permissions).toEqual([
      'dialog:allow-open',
      'fs:allow-exists',
      'fs:allow-read-dir',
      'fs:allow-read-file',
      'fs:allow-stat',
      'allow-pick-install-directory',
      'allow-list-install-files',
      'allow-read-install-file',
    ]);
    const joined = capability.permissions.join('\n');
    expect(joined).not.toContain('write');
    expect(joined).not.toContain('shell');
    expect(joined).not.toContain('updater');
    expect(joined).not.toContain('allow-save');
  });

  it('keeps the generated icon set small and original', () => {
    const names = readdirSync(iconDir);
    expect(names).toContain('icon-source.svg');
    expect(names).toContain('icon.png');
    expect(names).toContain('icon.icns');
    expect(names).toContain('icon.ico');
    expect(names).not.toContain('ios');
    expect(names).not.toContain('android');
    const source = readFileSync(join(iconDir, 'icon-source.svg'), 'utf8');
    expect(source.toLowerCase()).not.toContain('starfleet');
    expect(source).not.toContain('M12 2 L19 20');
    for (const name of names) {
      const path = join(iconDir, name);
      expect(statSync(path).isFile(), name).toBe(true);
      expect(statSync(path).size, name).toBeLessThanOrEqual(maxBytes);
    }
  });
});
