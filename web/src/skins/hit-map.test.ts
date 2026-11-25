import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { EMPIRE_SKINS } from './catalog.ts';
import { LOCKED_COLOUR_TOKENS, PANEL_SELECTOR, SKIN_BUTTON_TABLES, type ButtonTable } from './hit-map.ts';
import { skinVars } from './apply.ts';
import { resolvePlate } from './resolve.ts';

interface SkinMeasure {
  readonly empire: string;
  readonly table: ButtonTable;
  readonly panels: readonly string[];
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

  it('keeps panels, each skin\'s button table, and locked colours fixed across skins', async () => {
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
        const table = SKIN_BUTTON_TABLES[skin.id];
        const measured = await page.evaluate((input: { empire: string; vars: Record<string, string>; ids: readonly string[]; tokens: readonly string[]; panelSelector: string }) => {
          const root = document.documentElement;
          document.body.dataset.empire = input.empire;
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
          const panels = [...document.querySelectorAll(input.panelSelector)].map((node) => {
            const box = node.getBoundingClientRect();
            return `${node.getAttribute('aria-label') ?? node.id}:${[box.x, box.y, box.width, box.height].map((n) => Math.round(n)).join(',')}`;
          });
          const empire = document.body.dataset.empire ?? '';
          const style = getComputedStyle(root);
          const read: Record<string, string> = {};
          for (const token of input.tokens) read[token] = style.getPropertyValue(token).trim();
          const plate = document.querySelector('.plate');
          const heading = document.getElementById('heading');
          const edge = plate ? getComputedStyle(plate).borderRightColor : '';
          const text = heading ? getComputedStyle(heading).color : '';
          const button = document.getElementById('pause');
          const focus = button ? getComputedStyle(button).outlineColor : '';
          return { empire, panels, rects, tokens: read, text, edge, focus };
        }, { empire: skin.id, vars: { ...vars }, ids: table, tokens: LOCKED_COLOUR_TOKENS, panelSelector: PANEL_SELECTOR });
        measures.push({ ...measured, table });
      }
      const first = measures[0];
      if (!first) throw new Error('no skin');
      expect(Number(first.rects['helm-camera']?.split(',')[2])).toBeGreaterThan(0);
      expect(Number(first.rects['space']?.split(',')[2])).toBeGreaterThan(0);
      expect(Number(first.rects['energy']?.split(',')[2])).toBeGreaterThan(0);
      expect(Number(first.rects['energy']?.split(',')[3])).toBeGreaterThan(0);
      expect(first.panels.length).toBeGreaterThan(5);
      for (const [index, measure] of measures.entries()) {
        expect(measure.empire).toBe(EMPIRE_SKINS[index]?.id);
        expect(measure.panels).toEqual(first.panels);
        const sameTable = measures.find((other) => other.table === measure.table);
        expect(measure.rects).toEqual(sameTable?.rects);
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