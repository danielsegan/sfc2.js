import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { EMPIRE_SKINS } from './catalog.ts';
import { HIT_TARGET_IDS, LOCKED_COLOUR_TOKENS } from './hit-map.ts';
import { skinVars } from './apply.ts';
import { resolvePlate } from './resolve.ts';

interface SkinMeasure {
  readonly rects: Record<string, string>;
  readonly tokens: Record<string, string>;
  readonly text: string;
  readonly edge: string;
  readonly focus: string;
}

describe('empire skin hit targets', () => {
  it('does not let a skin set text, state, focus, or panel-edge tokens', () => {
    for (const skin of EMPIRE_SKINS) {
      for (const key of Object.keys(skinVars(skin, `./art/skins/${skin.id}/plate.svg`))) {
        expect(key.startsWith('--text')).toBe(false);
        expect(key.startsWith('--state-')).toBe(false);
        expect(key).not.toBe('--focus');
        expect(key).not.toBe('--panel-edge');
      }
    }
  });

  it('keeps rendered hit targets and locked colours the same for every skin', async () => {
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/src/style.css', 'utf8');
    const doc = html
      .replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
      .replace(/<script type="module"[\s\S]*?<\/script>/, '');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
      await page.setContent(doc, { waitUntil: 'load' });
      const measures: SkinMeasure[] = [];
      for (const skin of EMPIRE_SKINS) {
        const vars = skinVars(skin, `./art/skins/${skin.id}/plate.svg`);
        measures.push(await page.evaluate((input: { vars: Record<string, string>; ids: readonly string[]; tokens: readonly string[] }) => {
          const root = document.documentElement;
          for (const key of Object.keys(input.vars)) {
            const value = input.vars[key];
            if (value !== undefined) root.style.setProperty(key, value);
          }
          const rects: Record<string, string> = {};
          for (const id of input.ids) {
            const node = document.getElementById(id);
            if (!node) throw new Error(`missing ${id}`);
            const box = node.getBoundingClientRect();
            rects[id] = [box.x, box.y, box.width, box.height].map((n) => Math.round(n)).join(',');
          }
          const style = getComputedStyle(root);
          const read: Record<string, string> = {};
          for (const token of input.tokens) read[token] = style.getPropertyValue(token).trim();
          const plate = document.querySelector('.plate');
          const heading = document.getElementById('heading');
          const edge = plate ? getComputedStyle(plate).borderRightColor : '';
          const text = heading ? getComputedStyle(heading).color : '';
          const button = document.getElementById('pause');
          const focus = button ? getComputedStyle(button).outlineColor : '';
          return { rects, tokens: read, text, edge, focus };
        }, { vars: { ...vars }, ids: HIT_TARGET_IDS, tokens: LOCKED_COLOUR_TOKENS }));
      }
      const first = measures[0];
      if (!first) throw new Error('no skin');
      expect(Number(first.rects['helm-orbit']?.split(',')[2])).toBeGreaterThan(0);
      expect(Number(first.rects['space']?.split(',')[2])).toBeGreaterThan(0);
      for (const measure of measures) {
        expect(measure.rects).toEqual(first.rects);
        expect(measure.tokens).toEqual(first.tokens);
        expect(measure.text).toBe(first.text);
        expect(measure.edge).toBe(first.edge);
        expect(measure.focus).toBe(first.focus);
      }
    } finally {
      await browser.close();
    }
  });

  it('resolves plates as placeholder, then neutral, and never an unknown bitmap', () => {
    expect(resolvePlate('kli', ['Assets/bitmaps/ui/offScr.BMP', 'Assets/textures/Klingon-splat.BMP'])).toEqual({
      source: 'placeholder',
      path: 'art/skins/kli/plate.svg',
    });
    expect(resolvePlate('neutral', []).source).toBe('neutral');
  });
});