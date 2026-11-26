/**
 * Text form of a metrics report. Degrees and seconds are exact ratios.
 * Each row is scored against the observed reference at ±10%, or inside
 * the observed interval, or inside the roll's min and max.
 */
import { HEADING_TARGET, PHASER_CODE, PHOTON_CODE } from './ships.ts';
import { scoreNa, scoreNone, scorePoint, scoreRange, scoreRoll, type Scored } from './reference.ts';
import type {
  EnergySample,
  FirepowerSample,
  HeavySample,
  HetSample,
  MetricsReport,
  PhaserProbe,
  ShipReport,
  SpeedSample,
  TurnSample,
} from './run.ts';

export interface TableRow {
  readonly ship: string;
  readonly metric: string;
  readonly case: string;
  readonly ours: string;
  readonly reference: string;
  readonly confidence: string;
  readonly result: Scored['result'];
  readonly unit: string;
}

function fixed(numerator: number, denominator: number, places: number): string {
  if (denominator <= 0 || !Number.isInteger(numerator) || !Number.isInteger(denominator)) throw new Error('ratio');
  const negative = numerator < 0;
  const mag = negative ? -numerator : numerator;
  const scale = 10 ** places;
  const rounded = Math.floor((mag * scale + Math.floor(denominator / 2)) / denominator);
  const whole = Math.floor(rounded / scale);
  const frac = String(rounded % scale).padStart(places, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Inverse of the turn table's rounding: rate × 360 × 30 / 65536. */
export function degPerSec(rate16: number): string {
  return fixed(rate16 * 10800, 65536, 4);
}

export function ticksToSeconds(ticks: number): string {
  return fixed(ticks, 30, 4);
}

function degNumber(rate16: number): number {
  return (rate16 * 10800) / 65536;
}

function secondsNumber(ticks: number): number {
  return ticks / 30;
}

function pointsNumber(hundredths: number): number {
  return hundredths / 100;
}

function speedLabel(hundredths: number): string {
  return `speed ${fixed(hundredths, 100, 2)}`;
}

function row(
  ship: string,
  metric: string,
  caseLabel: string,
  ours: string,
  scored: Scored,
  unit: string,
): TableRow {
  return {
    ship,
    metric,
    case: caseLabel,
    ours,
    reference: scored.text,
    confidence: scored.confidence,
    result: scored.result,
    unit,
  };
}

const EXTRA_TURN: Readonly<Record<string, { speed: number; deg: number; delay: number; timeTo10: number; conf: 'H' | 'M'; scoreDelay?: boolean }>> = {
  'K-E4': { speed: 1000, deg: 10.1, delay: 0.75, timeTo10: 17.9, conf: 'M' },
  'K-F5': { speed: 1000, deg: 10.4, delay: 1, timeTo10: 25, conf: 'H' },
  'K-C8': { speed: 1000, deg: 8, delay: 1.1, timeTo10: 28.6, conf: 'H' },
  'R-SNA': { speed: 1000, deg: 7.35, delay: 1.1, timeTo10: 15.9, conf: 'M' },
  'R-KRC': { speed: 1000, deg: 10.9, delay: 2.25, timeTo10: 29.4, conf: 'M' },
  'R-CON': { speed: 1000, deg: 6.5, delay: 0.6, timeTo10: 30.3, conf: 'H' },
  'L-FF': { speed: 1000, deg: 11.4, delay: 1.6, timeTo10: 12.2, conf: 'M' },
  'L-CA': { speed: 1000, deg: 7.75, delay: 1.3, timeTo10: 31.3, conf: 'M' },
  'L-DN': { speed: 1000, deg: 7.5, delay: 1, timeTo10: 35.7, conf: 'M' },
  'H-HN': { speed: 1000, deg: 9.8, delay: 0.5, timeTo10: 6.5, conf: 'M' },
  'H-RN': { speed: 1000, deg: 8.7, delay: 1.3, timeTo10: 29.4, conf: 'M' },
  'H-PAL': { speed: 1000, deg: 7.9, delay: 1.7, timeTo10: 30.3, conf: 'H' },
  'G-FF': { speed: 2000, deg: 9.4, delay: 1.3, timeTo10: 12.2, conf: 'M' },
  'G-CA': { speed: 2000, deg: 9.3, delay: 1.3, timeTo10: 25.6, conf: 'M' },
  'G-DN': { speed: 1500, deg: 7.3, delay: 1.4, timeTo10: 20.8, conf: 'M' },
  'I-FF': { speed: 500, deg: 5.3, delay: 1, timeTo10: 12.5, conf: 'M' },
  'I-CA': { speed: 1000, deg: 7.25, delay: 1.95, timeTo10: 26.3, conf: 'M' },
  'I-DN': { speed: 1000, deg: 6.85, delay: 1.3, timeTo10: 20.8, conf: 'M' },
  'Z-FF': { speed: 500, deg: 6.8, delay: 3.6, timeTo10: 12.5, conf: 'M', scoreDelay: false },
  'Z-CA': { speed: 1000, deg: 8.25, delay: 1.45, timeTo10: 27, conf: 'H' },
  'Z-DN': { speed: 2000, deg: 6.5, delay: 0, timeTo10: 24.4, conf: 'M', scoreDelay: false },
};

const PLANT_AT_REST: Readonly<Record<string, { left: number; conf: 'H' | 'M' }>> = {
  'K-C8': { left: 54.5, conf: 'H' },
  'R-KRC': { left: 36.5, conf: 'H' },
  'R-CON': { left: 57.5, conf: 'H' },
  'L-CA': { left: 34.5, conf: 'H' },
  'L-DN': { left: 52.5, conf: 'M' },
  'H-RN': { left: 31.5, conf: 'M' },
  'H-PAL': { left: 51.5, conf: 'H' },
  'G-CA': { left: 35.5, conf: 'M' },
  'G-DN': { left: 55.5, conf: 'M' },
  'I-CA': { left: 37.5, conf: 'M' },
  'I-DN': { left: 53.5, conf: 'M' },
  'Z-CA': { left: 30.5, conf: 'H' },
  'Z-DN': { left: 52.5, conf: 'M' },
};

const EXTRA_HET: Readonly<Record<string, { deg: number; delay?: number; conf: 'H' | 'M' }>> = {
  'K-E4': { deg: 70, delay: 5.7, conf: 'H' },
  'K-F5': { deg: 65.7, delay: 5.5, conf: 'H' },
  'K-C8': { deg: 47, delay: 5.7, conf: 'H' },
  'R-SNA': { deg: 44, delay: 5.8, conf: 'M' },
  'R-KRC': { deg: 59, delay: 5.7, conf: 'M' },
  'R-CON': { deg: 42.5, delay: 5.55, conf: 'H' },
  'L-FF': { deg: 47.5, delay: 5.75, conf: 'M' },
  'L-CA': { deg: 50, delay: 6.05, conf: 'M' },
  'L-DN': { deg: 48, delay: 5.7, conf: 'M' },
  'H-HN': { deg: 62, delay: 5.8, conf: 'M' },
  'H-RN': { deg: 48, delay: 5.6, conf: 'M' },
  'H-PAL': { deg: 45.8, delay: 5.6, conf: 'H' },
  'G-FF': { deg: 57.5, delay: 6.3, conf: 'M' },
  'G-CA': { deg: 52, delay: 5.8, conf: 'M' },
  'G-DN': { deg: 42.4, delay: 6, conf: 'M' },
  'I-FF': { deg: 58.5, delay: 5.7, conf: 'M' },
  'I-CA': { deg: 44, delay: 5.7, conf: 'M' },
  'I-DN': { deg: 39.25, delay: 5.55, conf: 'M' },
  'Z-CA': { deg: 49.44, delay: 5.7, conf: 'H' },
  'Z-DN': { deg: 37.08, conf: 'M' },
};

function turnRateScore(ship: ShipReport, sample: TurnSample): Scored {
  const ours = degNumber(sample.turnRate16PerTick);
  const speed = sample.speedHundredths;
  if (ship.turnHull === 'F-CA') {
    if (speed === 500) return scorePoint(ours, 4.65, 'H');
    if (speed === 1000 || speed === 1500 || speed === 2000 || speed === 3050) return scoreRange(ours, 7.3, 7.9, 'H');
    return scoreNa();
  }
  if (ship.turnHull === 'F-FF') {
    if (speed === 500) return scorePoint(ours, 5.1, 'H');
    if (speed === 1000) return scorePoint(ours, 9.5, 'H');
    if (speed === 1500) return scorePoint(ours, 9.9, 'H');
    if (speed === 2000) return scorePoint(ours, 10, 'H');
    return scoreNa();
  }
  if (ship.turnHull === 'F-DN') {
    if (speed === 500) return scorePoint(ours, 4.3, 'H');
    if (speed === 1000) return scorePoint(ours, 6.2, 'H');
    if (speed === 1600) return scorePoint(ours, 6.9, 'H');
    if (speed === 2000) return scorePoint(ours, 7.4, 'H');
    return scoreNa();
  }
  if (ship.turnHull === 'Z-DN') {
    if (speed === 500) return scorePoint(ours, 4, 'M');
    if (speed === 2000) return scorePoint(ours, 6.5, 'M');
    return scoreNa();
  }
  const extra = EXTRA_TURN[ship.turnHull];
  if (extra) return speed === extra.speed ? scorePoint(ours, extra.deg, extra.conf) : scoreNa();
  if (ship.turnHull !== 'K-D7') return scoreNa();
  if (speed === 500) return scorePoint(ours, 5.4, 'M');
  if (speed === 1000 || speed === 1500 || speed === 2000 || speed === 3100) return scoreRange(ours, 9, 9.4, 'M');
  return scoreNa();
}

function hetRateScore(ship: ShipReport, sample: HetSample): Scored {
  const ours = degNumber(sample.turnRate16PerTick);
  if (ship.turnHull === 'F-CA') {
    if (sample.speedHundredths >= 3050) return scorePoint(ours, 52, 'M');
    return scoreRange(ours, 42, 46, 'M');
  }
  if (ship.turnHull === 'F-FF') return scorePoint(ours, 49, 'H');
  if (ship.turnHull === 'F-DN') return scorePoint(ours, 41.7, 'M');
  const extra = EXTRA_HET[ship.turnHull];
  if (extra) return scorePoint(ours, extra.deg, extra.conf);
  if (ship.turnHull !== 'K-D7') return scoreNa();
  return scoreRange(ours, 57.8, 59, 'H');
}

function timeScore(ship: ShipReport, sample: SpeedSample): Scored {
  const seconds = secondsNumber(sample.ticksFromRest);
  const tables: Readonly<Record<string, Readonly<Record<number, number>>>> = {
    'F-CA': { 500: 16.7, 1000: 31.7, 1500: 46.7, 2000: 61, 2500: 70, 3000: 78.3 },
    'F-FF': { 500: 6.1, 1000: 12.2, 1500: 18.3, 2000: 24.4, 2500: 30.5, 3000: 36.6, 3100: 38 },
    'F-DN': { 500: 16.1, 1000: 32.3, 1500: 48.4, 2000: 64.5, 2500: 80.6, 3000: 96.8 },
    'K-D7': { 500: 18, 1000: 30, 1500: 42, 2000: 54, 2500: 66, 3000: 78, 3100: 79.6 },
  };
  const table = tables[ship.turnHull];
  if (!table) {
    const extra = EXTRA_TURN[ship.turnHull];
    if (!extra || sample.speedHundredths !== 1000) return scoreNa();
    return scorePoint(seconds, extra.timeTo10, 'M');
  }
  const ref = table[sample.speedHundredths];
  if (ref === undefined) return scoreNa();
  return scorePoint(seconds, ref, 'M');
}

function phaserScore(ship: ShipReport, probe: PhaserProbe): Scored {
  if (ship.turnHull === 'K-D7') return phaser2Score(probe);
  return phaser1Score(probe);
}

function phaser1Score(probe: PhaserProbe): Scored {
  if (probe.range === 0 || probe.range === 1) return scoreRoll(probe.damage, 3, 6, 4.5, 'H');
  if (probe.range === 2) return scoreRoll(probe.damage, 2, 4, 3, 'H');
  if (probe.range === 4) return scoreRoll(probe.damage, 2, 3, 2.5, 'H');
  if (probe.range === 8) return scoreRoll(probe.damage, 1, 2, 1.5, 'H');
  if (probe.range === 12 || probe.range === 16 || probe.range === 20) return scoreRoll(probe.damage, 0, 1, 0.5, 'H');
  if (probe.range === 26) return scorePoint(probe.damage, 0, 'H');
  return scoreNone(probe.damage, 'H');
}

function phaser2Score(probe: PhaserProbe): Scored {
  if (probe.range === 0) return scoreRoll(probe.damage, 5, 6, 5.25, 'M');
  if (probe.range === 1) return scoreRoll(probe.damage, 3, 5, 4, 'M');
  if (probe.range === 2) return scoreRoll(probe.damage, 3, 4, 3.5, 'M');
  if (probe.range === 4) return scoreRoll(probe.damage, 0, 1, 0.5, 'M');
  if (probe.range === 8 || probe.range === 12 || probe.range === 16) return scorePoint(probe.damage, 0, 'M');
  return scoreNone(probe.damage, 'M');
}

function phaser3Score(probe: PhaserProbe): Scored {
  if (probe.range === 0 || probe.range === 2) return scoreRoll(probe.damage, 1, 2, 1.5, 'M');
  if (probe.range === 4) return scoreRoll(probe.damage, 0, 1, 0.5, 'M');
  return scoreNone(probe.damage, 'M');
}

const DISRUPTOR_HIT = [5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2] as const;
const DISRUPTOR_RANGE_K = [0, 1, 2, 3, 4, 8, 11, 15, 20, 25, 31] as const;

function disruptorExpected(rangeK: number): number {
  for (let i = 0; i < DISRUPTOR_RANGE_K.length; i++) {
    if (DISRUPTOR_RANGE_K[i] === rangeK) return DISRUPTOR_HIT[i]!;
  }
  return 0;
}

function disruptorScore(probe: PhaserProbe, expected: number, certain: boolean): Scored {
  if (certain) return scorePoint(probe.damage, expected, 'M');
  const text = `0 or ${String(expected)}`;
  if (probe.damage === null || (probe.damage !== 0 && probe.damage !== expected)) {
    return { text, confidence: 'M', result: 'fail' };
  }
  return { text, confidence: 'M', result: 'pass' };
}

function overloadExpected(rangeK: number): number | null {
  if (rangeK <= 1) return 10;
  if (rangeK <= 2) return 10;
  if (rangeK <= 4) return 8;
  if (rangeK <= 9) return 6;
  return null;
}

function photonScore(probe: PhaserProbe): Scored {
  const points = probe.damage === null ? null : pointsNumber(probe.damage);
  if (probe.range === 0) return scorePoint(points, 8, 'M');
  if (probe.range === 31) return scoreNone(probe.damage, 'M');
  if (points === null || (points !== 0 && points !== 8)) {
    return { text: '0 or 8', confidence: 'M', result: 'fail' };
  }
  return { text: '0 or 8', confidence: 'M', result: 'pass' };
}

function heavyTimeScore(sample: HeavySample): Scored {
  const seconds = secondsNumber(sample.ticksUntilReady);
  if (sample.weapon === PHOTON_CODE) return scorePoint(seconds, 64, 'M');
  return scorePoint(seconds, 33, 'L');
}

function heavyCostScore(sample: HeavySample): Scored {
  const confidence = sample.weapon === PHOTON_CODE ? 'H' : 'M';
  return scorePoint(sample.armPerTurn, 2, confidence);
}

function holdScore(sample: HeavySample): Scored {
  if (sample.weapon === PHOTON_CODE) return scorePoint(sample.holdCost, 1, 'H');
  return scorePoint(sample.holdCost, 2, 'M');
}

function firepowerScore(ship: ShipReport, sample: FirepowerSample): Scored {
  const ours = pointsNumber(sample.weaponHundredths);
  if (ship.turnHull === 'F-CA') {
    if (sample.speedHundredths === 0) return scorePoint(ours, 31.5, 'H');
    if (sample.speedHundredths === 1000) return scorePoint(ours, 21.5, 'H');
    if (sample.speedHundredths === 2000) return scorePoint(ours, 11.5, 'H');
    if (sample.speedHundredths === 3050) return scorePoint(ours, 1, 'H');
  }
  if (ship.turnHull === 'F-FF') {
    if (sample.speedHundredths === 0) return scorePoint(ours, 31.5, 'H');
    if (sample.speedHundredths === 1000) return scorePoint(ours, 21.5, 'H');
    if (sample.speedHundredths === 2000) return scorePoint(ours, 11.5, 'H');
    if (sample.speedHundredths === 3100) return scorePoint(ours, 0.5, 'H');
  }
  if (ship.turnHull === 'F-DN') {
    if (sample.speedHundredths === 0) return scorePoint(ours, 50.5, 'H');
    if (sample.speedHundredths === 1000) return scorePoint(ours, 40.5, 'H');
    if (sample.speedHundredths === 2000) return scorePoint(ours, 30.5, 'H');
    if (sample.speedHundredths === 3100) return scorePoint(ours, 19.5, 'H');
  }
  const plant = PLANT_AT_REST[ship.turnHull];
  if (plant) {
    if (sample.speedHundredths === 0) return scorePoint(ours, plant.left, plant.conf);
    return scoreNa();
  }
  if (ship.turnHull !== 'K-D7') return scoreNa();
  if (sample.speedHundredths === 0) return scorePoint(ours, 36.5, 'H');
  if (sample.speedHundredths === 1000) return scorePoint(ours, 26.5, 'H');
  if (sample.speedHundredths === 2000) return scorePoint(ours, 16.5, 'H');
  if (sample.speedHundredths === 3100) return scorePoint(ours, 5.5, 'H');
  return scoreNa();
}

function energyScore(sample: EnergySample): Scored {
  if (sample.speedHundredths <= 0) return scoreNa();
  const perPoint = sample.movementHundredths / sample.speedHundredths;
  return scorePoint(perPoint, 1, 'H');
}

export function tableRows(report: MetricsReport): readonly TableRow[] {
  const rows: TableRow[] = [];
  for (const ship of report.ships) pushShip(rows, ship);
  return rows;
}

function pushShip(rows: TableRow[], ship: ShipReport): void {
  for (const sample of ship.turns) {
    const delaySeconds = secondsNumber(sample.delayTicks);
    const extraTurn = EXTRA_TURN[ship.turnHull];
    const delayJudged = ship.turnHull === 'F-CA'
      ? scoreRange(delaySeconds, 1, 1.9, 'H')
      : ship.turnHull === 'F-FF'
        ? scorePoint(delaySeconds, 1.1, 'H')
        : ship.turnHull === 'F-DN'
          ? scorePoint(delaySeconds, 1.2, 'H')
          : extraTurn
            ? extraTurn.scoreDelay === false
              ? scoreNa()
              : scorePoint(delaySeconds, extraTurn.delay, extraTurn.conf)
            : ship.turnHull === 'K-D7'
              ? scoreRange(delaySeconds, 0.7, 1.8, 'M')
              : scoreNa();
    rows.push(
      row(
        ship.id,
        'turn rate',
        speedLabel(sample.speedHundredths),
        `${degPerSec(sample.turnRate16PerTick)} deg/s`,
        turnRateScore(ship, sample),
        'deg/s at 30 Hz',
      ),
    );
    rows.push(
      row(
        ship.id,
        'order-to-turn delay',
        speedLabel(sample.speedHundredths),
        `${ticksToSeconds(sample.delayTicks)} s`,
        delayJudged,
        'seconds from the heading order until the first heading change',
      ),
    );
  }
  for (const sample of ship.hets) {
    const rate = hetRateScore(ship, sample);
    rows.push(
      row(ship.id, 'HET rate', speedLabel(sample.speedHundredths), `${degPerSec(sample.turnRate16PerTick)} deg/s`, rate, 'deg/s at 30 Hz'),
    );
    const sweep = (sample.sweep16 * 360) / 65536;
    const sweepScore = ship.turnHull === 'F-CA'
      ? scorePoint(sweep, 89, 'M')
      : ship.turnHull === 'K-D7'
        ? scoreRange(sweep, 82, 98, 'M')
        : scoreNa();
    rows.push(row(ship.id, 'HET sweep', speedLabel(sample.speedHundredths), `${fixed(sample.sweep16 * 360, 65536, 2)} deg`, sweepScore, 'degrees'));
    const hetDelay = secondsNumber(sample.delayTicks);
    const extraHet = EXTRA_HET[ship.turnHull];
    const delayScore = ship.turnHull === 'F-CA'
      ? scoreRange(hetDelay, 5.5, 6, 'M')
      : ship.turnHull === 'F-FF'
        ? scorePoint(hetDelay, 5.35, 'H')
        : ship.turnHull === 'F-DN'
          ? scorePoint(hetDelay, 5.6, 'M')
          : extraHet
            ? extraHet.delay === undefined
              ? scoreNa()
              : scorePoint(hetDelay, extraHet.delay, extraHet.conf)
            : ship.turnHull === 'K-D7'
              ? scoreRange(hetDelay, 5.45, 5.93, 'H')
              : scoreNa();
    rows.push(
      row(
        ship.id,
        'HET delay',
        speedLabel(sample.speedHundredths),
        `${ticksToSeconds(sample.delayTicks)} s`,
        delayScore,
        'seconds from the HET order until the sweep starts',
      ),
    );
  }
  for (const sample of ship.timeToSpeed) {
    rows.push(
      row(
        ship.id,
        'time to speed',
        speedLabel(sample.speedHundredths),
        `${ticksToSeconds(sample.ticksFromRest)} s`,
        timeScore(ship, sample),
        'seconds from rest until actual speed reaches the order',
      ),
    );
  }
  for (const sample of ship.energy) {
    const per = sample.speedHundredths > 0 ? fixed(sample.movementHundredths, sample.speedHundredths, 2) : '0';
    rows.push(
      row(
        ship.id,
        'movement energy',
        speedLabel(sample.speedHundredths),
        `${per} per speed point`,
        energyScore(sample),
        'rule points per speed point per rules-turn',
      ),
    );
  }
  const decelPerSec = (ship.decel.hundredthsLost * 30) / ship.decel.ticks / 100;
  rows.push(
    row(
      ship.id,
      'deceleration',
      `from speed 20 over ${ship.decel.ticks} ticks`,
      `${fixed(ship.decel.hundredthsLost * 30, ship.decel.ticks * 100, 4)} speed/s`,
      scorePoint(decelPerSec, 1.1, 'M'),
      'speed points per second while slowing',
    ),
  );
  for (const probe of ship.phaser) {
    rows.push(
      row(
        ship.id,
        'phaser damage',
        `range ${probe.range}k`,
        probe.damage === null ? `none (${probe.reason})` : String(probe.damage),
        phaserScore(ship, probe),
        'damage points on one seeded roll, or the reject reason',
      ),
    );
  }
  for (const probe of ship.phaser3) {
    rows.push(
      row(
        ship.id,
        'phaser-3 damage',
        `range ${probe.range}k`,
        probe.damage === null ? `none (${probe.reason})` : String(probe.damage),
        phaser3Score(probe),
        'F-FF Phaser-3. About 1.5 under 4k and 0 through 10.3k',
      ),
    );
  }
  for (const probe of ship.disruptorDamage) {
    const expected = disruptorExpected(probe.range);
    const ours = probe.damage === null ? `none (${probe.reason})` : String(probe.damage);
    const scored = probe.range > 31
      ? scoreNone(probe.damage, 'M')
      : disruptorScore(probe, expected, probe.range <= 1);
    rows.push(
      row(
        ship.id,
        'disruptor damage',
        `range ${probe.range}k`,
        ours,
        scored,
        'fixed damage on a hit, or 0 on a miss. Past 31k the shot is out of range',
      ),
    );
  }
  for (const probe of ship.disruptorOverload) {
    const expected = overloadExpected(probe.range);
    const ours = probe.damage === null ? `none (${probe.reason})` : String(probe.damage);
    rows.push(
      row(
        ship.id,
        'disruptor overload',
        `range ${probe.range}k`,
        ours,
        expected === null ? scoreNone(probe.damage, 'M') : disruptorScore(probe, expected, probe.range === 0),
        'fixed overload damage on a hit. Past 9k the shot does nothing',
      ),
    );
  }
  for (const probe of ship.photonDamage) {
    const ours = probe.damage === null ? `none (${probe.reason})` : fixed(probe.damage, 100, 2);
    rows.push(
      row(ship.id, 'photon damage', `range ${probe.range}k`, ours, photonScore(probe), '8 points on a hit, or 0 on a miss'),
    );
  }
  rows.push(
    row(
      ship.id,
      'heavy arm cost',
      sampleCase(ship.heavy),
      `${ship.heavy.armPerTurn} per turn`,
      heavyCostScore(ship.heavy),
      'rule points per rules-turn while arming',
    ),
  );
  rows.push(
    row(
      ship.id,
      'heavy arm time',
      sampleCase(ship.heavy),
      `${ticksToSeconds(ship.heavy.ticksUntilReady)} s`,
      heavyTimeScore(ship.heavy),
      'seconds from the first arming order until the mount is ready',
    ),
  );
  rows.push(
    row(
      ship.id,
      'heavy hold cost',
      sampleCase(ship.heavy),
      `${ship.heavy.holdCost} per turn`,
      holdScore(ship.heavy),
      'rule points per rules-turn to keep an armed tube',
    ),
  );
  for (const shot of ship.shields) {
    rows.push(
      row(
        ship.id,
        'shield facing',
        `incoming bearing ${shot.bearing16}`,
        String(shot.facing),
        scorePoint(shot.facing, facingIndex(shot.bearing16), 'M'),
        'facing index, 0 = bow, clockwise, 60-degree bins',
      ),
    );
  }
  for (const sample of ship.firepower) {
    rows.push(
      row(
        ship.id,
        'power left for weapons',
        speedLabel(sample.speedHundredths),
        fixed(sample.weaponHundredths, 100, 2),
        firepowerScore(ship, sample),
        'rule points per rules-turn after the 2.5 systems load and movement',
      ),
    );
  }
}

function sampleCase(sample: HeavySample): string {
  return `${sample.weapon} normal`;
}

function facingIndex(bearing16: number): number {
  const bins = [0, 10923, 21845, 32768, 43691, 54613];
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] === bearing16) return i;
  }
  return -1;
}

function scenarioText(report: MetricsReport): string {
  return [
    '# Duel metrics',
    '',
    'Headless Phase 2 sim on synthetic hulls. Ours is what this build does.',
    'Reference is observed gameplay, scored at ±10% (a roll passes inside its min–max, a delay band passes inside the interval).',
    'The readings are written up in docs/rules/observed-reference.md. This table is not a capture from the original game.',
    '',
    '## Scenario',
    '',
    `- Tick rate: ${report.tickHz} Hz. One second is ${report.tickHz} ticks. \`step\` has no dt.`,
    `- Rules-turn: ${report.rulesTurnTicks} ticks (${report.rulesTurnTicks / report.tickHz} s), the named \`RULES_TURN_SECONDS\`. A photon is ready after two turns and a disruptor after one.`,
    `- Input delay: ${report.inputDelay}. Seed ${report.seed} (0x${report.seed.toString(16)}).`,
    '- Hulls: F-CA-like and F-FF-like use warp 34. F-DN-like uses warp 53. K-D7-like uses warp 39. A checkpoint hull uses its measured plant when that plant can pay the flown top speed. K-E4, K-F5, R-SNA, L-FF, H-HN, G-FF, and I-FF stay at warp 34 so the turn is not energy-capped. Each of those hulls has its own acceleration band.',
    '- Systems load when life support and fire control are on: 2.5. Movement stays 1 per ordered speed point. Weapon power is plant minus that load.',
    `- Heading order: verb 12, target ${HEADING_TARGET} (90° clockwise), after actual speed has reached the sample.`,
    '- HET: verb 13, starboard. Delay, rate, and sweep are measured from the sim, not copied off the table.',
    `- deg/s = BAM/tick × 10800 / 65536. A full circle is 65536.`,
    `- Phaser: \`${PHASER_CODE}\`, one combat-stream roll per shot. Range 0 is grouped with 1–2. A shared edge stays on the inner band. Nothing past 26.4k.`,
    `- Photon: \`${PHOTON_CODE}\` on the F-CA-like hull. Arming accepts 2 per rules-turn and is ready after ${report.rulesTurnTicks * 2} ticks (two rules-turns), then hold is 1. Damage is hundredths of a point by range.`,
    `- Disruptor: the K-D7-like heavy mount is Dis3. 2 per rules-turn, ready after ${report.rulesTurnTicks} ticks (one rules-turn), and the same 2 holds it. Overload is 4. Damage is fixed by range. A miss is 0. Normal bands run 0–1, 1.1–2, 2.1–3, 3.1–5, 5.1–16, and 16.1–31k. The cutoff is the measured 31000 range units. Dis1 is the shorter E4/F5 mount and is not this probe.`,
    '- Shields: six 60° facings. Bearing 0 is the bow center. The other five bearings are the clockwise bin centers.',
    '',
  ].join('\n');
}

function markdownTable(rows: readonly TableRow[]): string {
  const header = '| Ship | Metric | Case | Ours | Reference | Confidence | Result | Unit |';
  const rule = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map(
    (line) =>
      `| ${line.ship} | ${line.metric} | ${line.case} | ${line.ours} | ${line.reference} | ${line.confidence} | ${line.result} | ${line.unit} |`,
  );
  return [header, rule, ...body, ''].join('\n');
}

export function renderMarkdown(report: MetricsReport): string {
  return `${scenarioText(report)}\n${markdownTable(tableRows(report))}`;
}

export function renderJson(report: MetricsReport): string {
  return JSON.stringify({ ...report, rows: tableRows(report) }, null, 2);
}

export function failedRows(report: MetricsReport): readonly TableRow[] {
  const out: TableRow[] = [];
  for (const line of tableRows(report)) {
    if (line.result === 'fail') out.push(line);
  }
  return out;
}
