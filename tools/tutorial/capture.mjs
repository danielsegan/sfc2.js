/**
 * Playwright session. Drives the production page at 1920x1080 and
 * records the viewport. The dev install route must not answer.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { OPEN_MS, PAD_MS } from './segments.mjs';

const VIEW = { width: 1920, height: 1080 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function blur(page) {
  await page.evaluate(() => {
    const node = document.activeElement;
    if (node instanceof HTMLElement) node.blur();
    window.focus();
  });
}

function stagePoint(box, xFrac, yFrac) {
  return {
    x: box.x + box.width * xFrac,
    y: box.y + box.height * yFrac,
  };
}

export function bind(page) {
  return {
    page,
    sleep,
    blur: () => blur(page),
    async press(code) {
      await blur(page);
      await page.keyboard.press(code);
    },
    async pressShift(code) {
      await blur(page);
      await page.keyboard.down('Shift');
      try {
        await page.keyboard.press(code);
      } finally {
        await page.keyboard.up('Shift');
      }
    },
    async hold(code, ms) {
      await blur(page);
      await page.keyboard.down(code);
      try {
        await sleep(ms);
      } finally {
        await page.keyboard.up(code);
      }
    },
    async scrollInto(selector) {
      await page.locator(selector).scrollIntoViewIfNeeded();
    },
    async clickStage(xFrac, yFrac, button) {
      const box = await page.locator('#stage').boundingBox();
      if (!box) throw new Error('stage has no box');
      const point = stagePoint(box, xFrac, yFrac);
      const hit = await page.evaluate(({ x, y }) => {
        const node = document.elementFromPoint(x, y);
        if (!(node instanceof Element)) return 'none';
        return node.id || node.className || node.tagName;
      }, point);
      if (typeof hit === 'string' && /plate|button|input|select|label/.test(hit)) {
        throw new Error(`stage click hit chrome (${hit}) at ${xFrac},${yFrac}`);
      }
      await page.mouse.move(point.x, point.y, { steps: 10 });
      await page.mouse.click(point.x, point.y, { button, delay: 20 });
    },
    async middleDrag(xFrac, yFrac) {
      const box = await page.locator('#stage').boundingBox();
      if (!box) throw new Error('stage has no box');
      const point = stagePoint(box, xFrac, yFrac);
      await page.mouse.move(point.x, point.y, { steps: 6 });
      await page.mouse.down({ button: 'middle' });
      try {
        await page.mouse.move(point.x + 90, point.y + 16, { steps: 10 });
      } finally {
        await page.mouse.up({ button: 'middle' });
      }
    },
    async altDrag(xFrac, yFrac) {
      const box = await page.locator('#stage').boundingBox();
      if (!box) throw new Error('stage has no box');
      const point = stagePoint(box, xFrac, yFrac);
      await page.keyboard.down('Alt');
      try {
        await page.mouse.move(point.x, point.y, { steps: 6 });
        await page.mouse.down({ button: 'left' });
        await page.mouse.move(point.x - 80, point.y + 12, { steps: 10 });
        await page.mouse.up({ button: 'left' });
      } finally {
        await page.mouse.up({ button: 'left' }).catch(() => {});
        await page.keyboard.up('Alt');
      }
    },
    async wheelAt(xFrac, yFrac, deltaY) {
      const box = await page.locator('#stage').boundingBox();
      if (!box) throw new Error('stage has no box');
      const point = stagePoint(box, xFrac, yFrac);
      await page.mouse.move(point.x, point.y, { steps: 6 });
      await page.mouse.wheel(0, deltaY);
    },
    async clickShield(shift) {
      const canvas = page.locator('#shields');
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (!box) throw new Error('shield canvas has no box');
      const x = box.x + box.width / 2;
      const y = box.y + box.height * 0.18;
      if (shift) await page.keyboard.down('Shift');
      try {
        await page.mouse.move(x, y, { steps: 8 });
        await page.mouse.click(x, y, { delay: 20 });
      } finally {
        if (shift) await page.keyboard.up('Shift');
      }
    },
    async clickSpeed(frac) {
      const bar = page.locator('#field-speed-bar');
      const box = await bar.boundingBox();
      if (!box) throw new Error('speed bar has no box');
      const x = box.x + box.width * frac;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y, { steps: 8 });
      await page.mouse.click(x, y, { delay: 20 });
    },
    async expectText(id, value) {
      await page.waitForFunction(
        ({ id, value }) => document.getElementById(id)?.textContent === value,
        { id, value },
        { timeout: 2500 },
      );
    },
    async expectTextNot(id, value) {
      await page.waitForFunction(
        ({ id, value }) => {
          const text = document.getElementById(id)?.textContent ?? '';
          return text.length > 0 && text !== value;
        },
        { id, value },
        { timeout: 2500 },
      );
    },
    async expectNotice(needle) {
      await page.waitForFunction(
        (needle) => {
          const notice = document.getElementById('notice')?.textContent ?? '';
          const log = document.getElementById('log')?.textContent ?? '';
          return notice.includes(needle) || log.includes(needle);
        },
        needle,
        { timeout: 2500 },
      );
    },
    async expectAttr(name, value) {
      await page.waitForFunction(
        ({ name, value }) => document.body.getAttribute(name) === value,
        { name, value },
        { timeout: 2500 },
      );
    },
  };
}

async function releaseKeys(page) {
  for (const code of ['Shift', 'Alt', 'Control', 'Meta', 'KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    await page.keyboard.up(code).catch(() => {});
  }
}

async function assertFixture(page, origin) {
  const manifest = await page.request.get(`${origin}/__dev/install/manifest`);
  const body = await manifest.text();
  if (body.includes('"files"')) {
    throw new Error('The dev install route returned a file list. Refusing to record.');
  }
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 20000 });
  await page.waitForFunction(() => {
    const source = document.getElementById('source')?.textContent ?? '';
    return source.includes('engine/duel/fixture.ts');
  }, null, { timeout: 5000 });
  await page.waitForFunction(() => {
    const select = document.getElementById('player-ship');
    const label = select instanceof HTMLSelectElement ? select.selectedOptions[0]?.textContent ?? '' : '';
    return /fixture/i.test(label);
  }, null, { timeout: 5000 });
  const source = await page.locator('#source').innerText();
  if (/install/i.test(source) && !source.includes('fixture')) {
    throw new Error(`Page source does not look like the fixture: ${source}`);
  }
}

function cursorScript() {
  const style = document.createElement('style');
  style.textContent = [
    '#tutorial-cursor {',
    '  position: fixed;',
    '  width: 22px;',
    '  height: 22px;',
    '  margin: -11px 0 0 -11px;',
    '  border: 2px solid #ffffff;',
    '  border-radius: 50%;',
    '  box-shadow: 0 0 0 1px #101820, 0 0 0 4px rgba(16,24,32,0.45);',
    '  pointer-events: none;',
    '  z-index: 10000;',
    '  left: -40px;',
    '  top: -40px;',
    '}',
    '#tutorial-cursor::after {',
    '  content: "";',
    '  position: absolute;',
    '  left: 8px;',
    '  top: 8px;',
    '  width: 4px;',
    '  height: 4px;',
    '  background: #ffffff;',
    '  border-radius: 50%;',
    '}',
  ].join('');
  document.documentElement.append(style);
  const dot = document.createElement('div');
  dot.id = 'tutorial-cursor';
  const place = (event) => {
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
  };
  document.addEventListener('pointermove', place, true);
  document.addEventListener('pointerdown', place, true);
  document.documentElement.append(dot);
}

export async function recordSession({ origin, segments, outDir, screenshot }) {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1920,1080',
    ],
  });
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    recordVideo: screenshot
      ? undefined
      : { dir: outDir, size: VIEW },
  });
  await context.addInitScript(() => {
    localStorage.setItem('sfc2js.uiScale.v1', '1');
    localStorage.removeItem('sfc2js.keymap.v1');
  });
  await context.addInitScript(cursorScript);
  const beforePage = performance.now();
  const page = await context.newPage();
  const pageReady = performance.now();
  try {
    await page.goto(`${origin}/?hudScale=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await assertFixture(page, origin);
    const layout = await page.evaluate(() => {
      const stage = document.getElementById('stage')?.getBoundingClientRect();
      return {
        stageTop: stage?.top ?? 0,
        stageBottom: stage?.bottom ?? 0,
        height: window.innerHeight,
        width: window.innerWidth,
      };
    });
    if (screenshot) {
      await page.screenshot({ path: screenshot, type: 'png' });
      const ctx = bind(page);
      await ctx.press('F1');
      await ctx.expectText('speed-ordered', '8');
      await ctx.press('Numpad8');
      const probePath = screenshot.replace(/\.png$/, '-probe.png');
      await page.screenshot({ path: probePath, type: 'png' });
      const ordered = await page.locator('#speed-ordered').innerText();
      const shield = await page.locator('#shield-table').innerText();
      console.log(`probe ordered speed ${ordered}`);
      console.log(`probe shields ${shield.replaceAll('\n', ' | ')}`);
      return { layout, videoPath: null, walls: [], leadMs: 0, openMs: OPEN_MS, probePath };
    }
    await page.waitForFunction(() => {
      const button = document.querySelector('button[data-slot="0"]');
      return button instanceof HTMLElement && button.classList.contains('ready');
    }, null, { timeout: 15000 });
    const timeline = performance.now();
    await sleep(OPEN_MS);
    console.log('Weapons are charged. Starting the timed capture.');
    const ctx = bind(page);
    const walls = [];
    for (const segment of segments) {
      console.log(`segment ${segment.id}`);
      const budget = segment.audioMs + PAD_MS;
      const started = performance.now();
      try {
        await segment.play(ctx, budget);
      } finally {
        await releaseKeys(page);
      }
      const elapsed = performance.now() - started;
      if (elapsed < budget) await sleep(budget - elapsed);
      walls.push(performance.now() - started);
    }
    await sleep(400);
    const closed = performance.now();
    const video = page.video();
    await context.close();
    const videoPath = video ? await video.path() : null;
    if (!videoPath) throw new Error('Playwright did not write a video');
    return {
      layout,
      videoPath,
      walls,
      leadMs: Math.max(0, timeline - pageReady - 120),
      pageSkewMs: pageReady - beforePage,
      tailMs: closed - timeline,
      openMs: OPEN_MS,
    };
  } catch (error) {
    await page.screenshot({ path: join(outDir, 'failure.png'), type: 'png' }).catch(() => {});
    throw error;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
