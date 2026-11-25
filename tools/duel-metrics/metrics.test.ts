import { describe, expect, it } from 'vitest';
import { facingForRelative } from '../../engine/sim/arcs.ts';
import { degPerSec, renderJson, renderMarkdown, tableRows } from './report.ts';
import { collectMetrics } from './run.ts';
import { BEARINGS, SPEEDS } from './ships.ts';

const report = collectMetrics();

function ship(id: 'F-CA-like' | 'K-D7-like') {
  const found = report.ships.find((row) => row.id === id);
  if (!found) throw new Error(id);
  return found;
}

function turn(id: 'F-CA-like' | 'K-D7-like', speed: number) {
  const sample = ship(id).turns.find((row) => row.speed === speed);
  if (!sample) throw new Error(`${id} ${speed}`);
  return sample;
}

describe('duel metrics', () => {
  it('repeats on the synthetic hulls', () => {
    expect(renderJson(collectMetrics())).toBe(renderJson(report));
  });

  it('measures heading-order turn rate and delay at the probe speeds', () => {
    expect(SPEEDS).toEqual([5, 10, 15, 20, 31]);
    expect(turn('F-CA-like', 5)).toMatchObject({ delayTicks: 44, turnRate16PerTick: 29, steadyRate16PerTick: 29, headingOrder: 'verb-12' });
    expect(turn('F-CA-like', 10)).toMatchObject({ delayTicks: 44, turnRate16PerTick: 47, steadyRate16PerTick: 47 });
    expect(turn('F-CA-like', 15)).toMatchObject({ delayTicks: 44, turnRate16PerTick: 46, steadyRate16PerTick: 46 });
    expect(turn('F-CA-like', 20)).toMatchObject({ delayTicks: 44, turnRate16PerTick: 46, steadyRate16PerTick: 46 });
    expect(turn('F-CA-like', 31)).toMatchObject({ delayTicks: 44, turnRate16PerTick: 49, steadyRate16PerTick: 49 });
    expect(turn('K-D7-like', 5)).toMatchObject({ delayTicks: 69, turnRate16PerTick: 32, steadyRate16PerTick: 32 });
    expect(turn('K-D7-like', 10)).toMatchObject({ delayTicks: 27, turnRate16PerTick: 61, steadyRate16PerTick: 61 });
    expect(turn('K-D7-like', 20)).toMatchObject({ delayTicks: 54, turnRate16PerTick: 57, steadyRate16PerTick: 57 });
    expect(turn('K-D7-like', 31)).toMatchObject({ delayTicks: 54, turnRate16PerTick: 57, steadyRate16PerTick: 57 });
    expect(turn('K-D7-like', 15)).toMatchObject({ delayTicks: 41, turnRate16PerTick: 59, steadyRate16PerTick: 59 });
    expect(degPerSec(47)).toBe('7.7454');
  });

  it('ramps speed with setEnergy and charges one rule point per speed point', () => {
    const fast = ship('F-CA-like').timeToSpeed.find((row) => row.speed === 31);
    const slow = ship('K-D7-like').timeToSpeed.find((row) => row.speed === 5);
    expect(fast).toEqual({ speed: 31, ticksFromFirstApply: 3, trace: [8, 16, 24, 31] });
    expect(slow).toEqual({ speed: 5, ticksFromFirstApply: 0, trace: [5] });
    for (const hull of report.ships) {
      for (const sample of hull.energy) {
        expect(sample.rulePointsPerRulesTurn).toBe(sample.speed);
        expect(sample.perSpeedPointNumerator).toBe(sample.speed);
        expect(sample.perSpeedPointDenominator).toBe(sample.speed);
        expect(sample.perTickDenominator).toBe(900);
      }
    }
  });

  it('records phaser bands, photon arming, shield facings, and leftover weapon power', () => {
    const phaser = ship('F-CA-like').phaser;
    expect(phaser.find((row) => row.range === 0)).toMatchObject({ band: '0', damage: 3, reason: 'ok' });
    expect(phaser.find((row) => row.range === 10)).toMatchObject({ band: '9-15', damage: 3, reason: 'ok' });
    expect(phaser.find((row) => row.range === 11)).toMatchObject({ band: '9-15', damage: 1, reason: 'ok' });
    expect(phaser.find((row) => row.range === 20)).toMatchObject({ band: '16-25', damage: 1, reason: 'ok' });
    expect(phaser.find((row) => row.range === 21)).toMatchObject({ band: '16-25', damage: null, reason: 'outOfRange' });
    expect(phaser.find((row) => row.range === 26)).toMatchObject({ band: '26+', damage: null, reason: 'outOfRange' });
    expect(ship('K-D7-like').phaser).toEqual(phaser);

    const heavy = ship('F-CA-like').heavy;
    expect(heavy.catalogArmCost).toBe(4);
    expect(heavy.catalogArmTicks).toBe(4);
    expect(heavy.energyPaidRulePoints).toBe(4);
    expect(heavy.ticksUntilReady).toBe(900);
    expect(ship('K-D7-like').heavy).toEqual(heavy);

    expect(BEARINGS).toHaveLength(6);
    for (const shot of ship('F-CA-like').shields) {
      expect(shot.facing).toBe(facingForRelative(shot.bearing16));
      expect(shot.damage).toBe(3);
    }
    expect(ship('F-CA-like').shields.map((shot) => shot.facing)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ship('K-D7-like').shields).toEqual(ship('F-CA-like').shields);

    expect(ship('F-CA-like').firepower).toEqual([
      { speed: 0, weaponRulePoints: 38, lifeRulePoints: 1, fireControlRulePoints: 1, movementRulePoints: 0 },
      { speed: 10, weaponRulePoints: 28, lifeRulePoints: 1, fireControlRulePoints: 1, movementRulePoints: 10 },
      { speed: 20, weaponRulePoints: 18, lifeRulePoints: 1, fireControlRulePoints: 1, movementRulePoints: 20 },
      { speed: 31, weaponRulePoints: 7, lifeRulePoints: 1, fireControlRulePoints: 1, movementRulePoints: 31 },
    ]);
    expect(ship('K-D7-like').firepower).toEqual(ship('F-CA-like').firepower);
  });

  it('prints a markdown table that names units and both hulls', () => {
    const text = renderMarkdown(report);
    const rows = tableRows(report);
    expect(text).toContain('deg/s');
    expect(text).toContain('F-CA-like');
    expect(text).toContain('K-D7-like');
    expect(text).toContain('verb 12');
    expect(rows.some((row) => row.metric === 'turn rate' && row.case === 'speed 10' && row.value.includes('7.7454'))).toBe(true);
    expect(rows.filter((row) => row.metric === 'shield facing')).toHaveLength(12);
  });
});
