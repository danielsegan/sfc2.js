import { expect, test } from '@playwright/test';

test('tactical field opens overhead with crisp fractional bars', async ({ page }) => {
  await page.goto('/?smoke=1&hudScale=1.5');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  await expect(page.locator('body')).toHaveAttribute('data-camera', 'overhead');
  await expect(page.locator('#top-bar')).toBeVisible();
  await expect(page.locator('#bottom-bar')).toBeVisible();
  const top = await page.locator('#top-bar').evaluate((node) => Math.round(node.getBoundingClientRect().height));
  const bottom = await page.locator('#bottom-bar').evaluate((node) => Math.round(node.getBoundingClientRect().height));
  expect(top).toBeGreaterThanOrEqual(34);
  expect(top).toBeLessThanOrEqual(38);
  expect(bottom).toBeGreaterThanOrEqual(46);
  expect(bottom).toBeLessThanOrEqual(50);
  const store = await page.locator('#space').evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const ratio = window.devicePixelRatio || 1;
    return { width: canvas.width, css: canvas.clientWidth, ratio };
  });
  expect(store.width).toBe(Math.round(store.css * store.ratio));
  await page.locator('#space').click({ button: 'right', position: { x: 8, y: 8 } });
  await expect(page.locator('body')).toHaveAttribute('data-camera', 'overhead');
  const lit = await page.evaluate(() => {
    const canvas = document.querySelector('#space');
    if (!(canvas instanceof HTMLCanvasElement)) return 0;
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 0;
    const width = Math.min(180, canvas.width);
    const height = Math.min(120, canvas.height);
    const x = Math.max(0, Math.floor((canvas.width - width) / 2));
    const y = Math.max(0, Math.floor((canvas.height - height) / 2));
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0;
    for (let i = 0; i < pixels.length; i += 16) {
      const red = pixels[i] ?? 0;
      const green = pixels[i + 1] ?? 0;
      const blue = pixels[i + 2] ?? 0;
      if (red > 12 || green > 12 || blue > 18) count += 1;
    }
    return count;
  });
  expect(lit).toBeGreaterThan(8);
});

test('field stays clear of page chrome and is lit on both halves at 1280x720', async ({ page }) => {
  await page.goto('/?smoke=1&hudScale=1');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 20_000 });
  const layout = await page.evaluate(() => {
    const rect = (id: string) => {
      const node = document.getElementById(id) ?? document.querySelector(id);
      if (!(node instanceof HTMLElement)) return null;
      const box = node.getBoundingClientRect();
      return { top: box.top, left: box.left, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (a: { top: number; left: number; right: number; bottom: number }, b: { top: number; left: number; right: number; bottom: number }) => {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    };
    const stage = rect('#stage');
    const header = rect('.top');
    const skirmish = rect('#skirmish');
    const consoleBox = rect('#console');
    const topBar = rect('#top-bar');
    const bottomBar = rect('#bottom-bar');
    return {
      stage,
      header,
      skirmish,
      consoleBox,
      topBar,
      bottomBar,
      overlaps: {
        header: !!(stage && header && overlap(stage, header)),
        skirmish: !!(stage && skirmish && overlap(stage, skirmish)),
        console: !!(stage && consoleBox && overlap(stage, consoleBox)),
        topBar: !!(stage && topBar && overlap(stage, topBar)),
        bottomBar: !!(stage && bottomBar && overlap(stage, bottomBar)),
      },
    };
  });
  expect(layout.stage?.height ?? 0).toBeGreaterThanOrEqual(280);
  expect(layout.overlaps.header).toBe(false);
  expect(layout.overlaps.skirmish).toBe(false);
  expect(layout.overlaps.console).toBe(false);
  expect(layout.overlaps.topBar).toBe(false);
  expect(layout.overlaps.bottomBar).toBe(false);
  const halves = await page.evaluate(() => {
    const canvas = document.querySelector('#space');
    if (!(canvas instanceof HTMLCanvasElement)) return { left: 0, right: 0 };
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return { left: 0, right: 0 };
    const band = Math.max(8, Math.floor(canvas.width * 0.18));
    const height = canvas.height;
    const read = (x: number) => {
      const pixels = new Uint8Array(band * height * 4);
      gl.readPixels(x, 0, band, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if ((pixels[i] ?? 0) > 12 || (pixels[i + 1] ?? 0) > 12 || (pixels[i + 2] ?? 0) > 18) count += 1;
      }
      return count;
    };
    return { left: read(Math.floor(canvas.width * 0.08)), right: read(Math.floor(canvas.width * 0.74)) };
  });
  expect(halves.left).toBeGreaterThan(20);
  expect(halves.right).toBeGreaterThan(20);
});
