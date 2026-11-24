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
