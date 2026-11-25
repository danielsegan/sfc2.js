import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { devInstallPlugin } from '../../web/dev-install-server.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');

export default defineConfig({
  root: here,
  publicDir: false,
  logLevel: 'silent',
  plugins: [devInstallPlugin()],
  server: {
    host: '127.0.0.1',
    fs: { allow: [repo] },
  },
});
