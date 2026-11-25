/**
 * Serve the check page and read one metadata summary back from Chromium.
 * The page renders with the viewer stage. This process never receives pixels.
 */

import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { inspectReport, type ViewerCheckReport } from './report.ts';

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export interface RunViewerCheckOptions {
  synthetic?: boolean;
  /** Absolute install root. Used only on this machine. It is not put in the report. */
  install?: string;
  frames?: number;
  timeoutMs?: number;
}

export interface ViewerCheckRun {
  report: ViewerCheckReport | null;
  /** `ok` when a safe summary came back. Other values are harness failures. */
  status: 'ok' | 'no-report' | 'no-install' | 'no-webgl' | 'unsafe' | 'withheld';
  /** A short page error with machine paths removed, or null. */
  pageError: string | null;
}

interface CheckWindow {
  __viewerCheck?: unknown;
}

export async function runViewerCheck(options: RunViewerCheckOptions): Promise<ViewerCheckRun> {
  const synthetic = options.synthetic === true;
  const timeoutMs = options.timeoutMs ?? 80 * 60 * 1000;
  if (!synthetic) {
    if (options.install === undefined || options.install.length === 0) {
      throw new Error('set SFC2_REFERENCE or pass --install');
    }
    await assertDirectory(options.install);
  }

  const previousInstall = process.env.SFC2_INSTALL;
  if (!synthetic && options.install !== undefined) process.env.SFC2_INSTALL = options.install;

  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;
  const pageErrors: string[] = [];
  try {
    server = await createServer({
      configFile: fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0 },
    });
    await server.listen();
    const bound = server.httpServer?.address();
    if (bound === null || bound === undefined || typeof bound === 'string') {
      throw new Error('viewer server did not bind');
    }
    const frames = options.frames ?? 3;
    const query = synthetic ? `synthetic=1&frames=${frames}` : `install=1&frames=${frames}`;
    const url = `http://127.0.0.1:${bound.port}/index.html?${query}`;

    browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
    const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
    page.setDefaultTimeout(timeoutMs);
    page.on('console', (message) => {
      const text = message.text();
      if (/^progress \d+ \d+$/.test(text)) process.stderr.write(`${text}\n`);
    });
    page.on('pageerror', (error) => {
      pageErrors.push(safePageError(error.message));
    });
    await page.goto(url, { waitUntil: 'commit', timeout: timeoutMs });
    await page.waitForSelector('body[data-done="1"]', { timeout: timeoutMs });
    return await readResult(page, pageErrors);
  } finally {
    await browser?.close();
    await server?.close();
    if (previousInstall === undefined) delete process.env.SFC2_INSTALL;
    else process.env.SFC2_INSTALL = previousInstall;
  }
}

async function readResult(page: Page, pageErrors: readonly string[]): Promise<ViewerCheckRun> {
  const fail = await page.locator('body').getAttribute('data-fail');
  const raw = await page.evaluate(() => (window as CheckWindow).__viewerCheck);
  const pageError = pageErrors[0] ?? null;
  if (fail === 'unsafe') return { report: null, status: 'unsafe', pageError };
  if (raw === undefined) return { report: null, status: 'no-report', pageError };
  const inspected = inspectReport(raw);
  if (inspected.report === null || inspected.problem === 'leak' || inspected.problem === 'shape' || inspected.problem === 'mismatch') {
    return { report: null, status: 'withheld', pageError };
  }
  if (fail === 'check-failed') return { report: inspected.report, status: 'no-report', pageError };
  if (fail === 'no-install' || inspected.problem === 'empty') {
    return { report: inspected.report, status: 'no-install', pageError };
  }
  if (fail === 'no-webgl') return { report: inspected.report, status: 'no-webgl', pageError };
  return { report: inspected.report, status: 'ok', pageError };
}

async function assertDirectory(install: string): Promise<void> {
  try {
    const info = await stat(install);
    if (!info.isDirectory()) throw new Error('not-dir');
  } catch {
    throw new Error('install directory was not found');
  }
}

function safePageError(message: string): string {
  if (message.length === 0 || message.length > 180) return 'page-error';
  if (message.includes('\\') || message.includes('/') || /^[a-zA-Z]:/.test(message)) return 'page-error';
  return message;
}
