import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { devInstallPlugin } from './dev-install-server.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

export default defineConfig({
  root: here,
  publicDir: false,
  plugins: [devInstallPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    fs: { allow: [repo] },
  },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
  },
});
