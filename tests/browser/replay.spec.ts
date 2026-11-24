import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

interface HashRow {
  tick: number;
  stateHash: number;
  eventHash: number;
}

interface ReplayRow {
  file: string;
  ok: boolean;
  kind: string;
  detail: string;
  hashes: HashRow[];
}

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function firstMismatch(left: readonly HashRow[], right: readonly HashRow[]): number | null {
  const count = left.length > right.length ? left.length : right.length;
  for (let i = 0; i < count; i++) {
    const a = left[i];
    const b = right[i];
    if (!a || !b || a.tick !== b.tick || a.stateHash !== b.stateHash || a.eventHash !== b.eventHash) {
      return a?.tick ?? b?.tick ?? -1;
    }
  }
  return null;
}

function findRow(rows: readonly ReplayRow[], fileName: string): ReplayRow | undefined {
  for (const row of rows) {
    if (row.file.endsWith(`/${fileName}`) || row.file === fileName) return row;
  }
  return undefined;
}

test('browser hash timeline matches Node', async ({ page }) => {
  const node = spawnSync(
    process.execPath,
    ['--experimental-strip-types', join(root, 'engine/replay/cli.ts'), 'json', 'replays'],
    { cwd: root, encoding: 'utf8' },
  );
  expect(node.status, node.stderr).toBe(0);
  const nodeRows = JSON.parse(node.stdout) as ReplayRow[];
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  const browserRows = JSON.parse(await page.locator('#out').innerText()) as ReplayRow[];
  expect(browserRows.length).toBeGreaterThan(0);
  for (const nodeRow of nodeRows) {
    if (!nodeRow.ok) continue;
    const fileName = nodeRow.file.slice(nodeRow.file.lastIndexOf('/') + 1);
    const browserRow = findRow(browserRows, fileName);
    expect(browserRow, fileName).toBeTruthy();
    if (!browserRow) continue;
    const tick = firstMismatch(nodeRow.hashes, browserRow.hashes);
    expect(
      tick,
      `${fileName} first divergent tick: ${String(tick)} browser=${browserRow.detail}`,
    ).toBeNull();
    expect(browserRow.ok, browserRow.detail).toBe(true);
  }
});
