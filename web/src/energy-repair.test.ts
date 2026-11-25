import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENERGY_PRIORITIES,
  REPAIR_SYSTEM_IDS,
  cycleEnergyPriority,
  defaultRepairQueue,
  energyRowValues,
  nextEnergyPriorities,
  prioritizeRepairSystem,
  repairQueueRank,
  repairSystemHealth,
} from './energy-repair.ts';

describe('energy priority cycle', () => {
  it('cycles 5 -> 4 -> 3 -> 2 -> 1 -> 5 on left-click', () => {
    const seen: number[] = [];
    let p = 5;
    for (let i = 0; i < 6; i++) {
      seen.push(p);
      p = cycleEnergyPriority(p);
    }
    expect(seen).toEqual([5, 4, 3, 2, 1, 5]);
  });

  it('updates only the targeted category in nextEnergyPriorities', () => {
    const start = { ...DEFAULT_ENERGY_PRIORITIES };
    const step1 = nextEnergyPriorities(start, 'weapons');
    expect(step1).toEqual({
      movement: 3,
      weapons: 2,
      shields: 3,
      tractors: 3,
      ecm: 3,
    });
    const step2 = nextEnergyPriorities(step1, 'weapons');
    expect(step2.weapons).toBe(1);
    const step3 = nextEnergyPriorities(step2, 'weapons');
    expect(step3.weapons).toBe(5);
  });

  it('computes read-only meter values and hides desired during overdraw unless explicitly published', () => {
    const ok = energyRowValues(
      {
        generation: 30,
        demand: 20,
        surplus: 10,
        lastReason: 'ok',
        draws: { movement: 10, weapons: 5, shields: 5, tractors: 0, ecm: 0, other: 0, cloak: 0 },
      },
      'movement',
    );
    expect(ok).toEqual({ allocated: 10, desired: 10, barPct: 33 });

    const overdraw = energyRowValues(
      {
        generation: 20,
        demand: 30,
        surplus: -10,
        lastReason: 'overDraw',
        draws: { movement: 10, weapons: 0, shields: 10, tractors: 0, ecm: 0, other: 0, cloak: 0 },
      },
      'weapons',
    );
    expect(overdraw).toEqual({ allocated: 0, desired: null, barPct: 0 });
  });
});

describe('repair queue ordering', () => {
  it('moves the prioritized system to the front and keeps remaining systems in queue order', () => {
    const start = defaultRepairQueue();
    expect(start).toEqual(REPAIR_SYSTEM_IDS);
    const next = prioritizeRepairSystem(start, 'sensors');
    expect(next[0]).toBe('sensors');
    expect(next).toHaveLength(REPAIR_SYSTEM_IDS.length);
    expect(next.slice(1)).toEqual(['bridge', 'hullForward', 'hullCenter', 'hullAft', 'armor', 'extra']);
    expect(repairQueueRank(next, 'sensors')).toBe(1);
    expect(repairQueueRank(next, 'bridge')).toBe(2);
  });

  it('ignores unknown system ids', () => {
    const start = ['bridge', 'sensors'];
    expect(prioritizeRepairSystem(start, 'phasers')).toEqual(['bridge', 'sensors']);
  });

  it('reports health state for intact, damaged, destroyed, and repairing systems', () => {
    expect(repairSystemHealth({ boxesTotal: 6, boxesLeft: 6, repairing: false })).toEqual({ ratio: 1, state: 'intact' });
    expect(repairSystemHealth({ boxesTotal: 6, boxesLeft: 3, repairing: false })).toEqual({ ratio: 0.5, state: 'damaged' });
    expect(repairSystemHealth({ boxesTotal: 6, boxesLeft: 0, repairing: false })).toEqual({ ratio: 0, state: 'destroyed' });
    expect(repairSystemHealth({ boxesTotal: 6, boxesLeft: 2, repairing: true })).toEqual({
      ratio: 2 / 6,
      state: 'repairing',
    });
  });
});

describe('energy page DOM right-click and meter inertness', () => {
  it('ignores right-click on priority and battery buttons and leaves meters inert', async () => {
    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/src/style.css', 'utf8');
    const doc = html
      .replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
      .replace(/<script type="module"[\s\S]*?<\/script>/, '');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.setContent(doc, { waitUntil: 'load' });
      const result = await page.evaluate(() => {
        const energy = document.getElementById('energy');
        const priBtn = document.querySelector<HTMLButtonElement>('[data-energy-pri="movement"]');
        const batBtn = document.getElementById('energy-battery-btn');
        const meter = document.querySelector<HTMLElement>('[data-energy-meter="movement"]');
        if (!energy || !priBtn || !batBtn || !meter) throw new Error('missing energy elements');
        energy.classList.add('active');
        const fired: string[] = [];
        energy.addEventListener('contextmenu', (event) => event.preventDefault());
        energy.addEventListener('auxclick', (event) => event.preventDefault());
        document.body.addEventListener('click', (event) => {
          const action = (event.target as Element | null)?.closest<HTMLElement>('[data-action]')?.dataset.action;
          if (action) fired.push(action);
        });
        priBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
        priBtn.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }));
        batBtn.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
        meter.click();
        const countAfterRightAndMeter = fired.length;
        priBtn.click();
        batBtn.click();
        return {
          countAfterRightAndMeter,
          firedAfterLeft: fired,
          meterPointerEvents: getComputedStyle(meter).pointerEvents,
          hasActionOnMeter: meter.hasAttribute('data-action'),
        };
      });
      expect(result.countAfterRightAndMeter).toBe(0);
      expect(result.firedAfterLeft).toEqual(['energy.priority.movement', 'energy.battery']);
      expect(result.meterPointerEvents).toBe('none');
      expect(result.hasActionOnMeter).toBe(false);
    } finally {
      await browser.close();
    }
  });
});
