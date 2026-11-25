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

function turnRateScore(ship: ShipReport, sample: TurnSample): Scored {
  const ours = degNumber(sample.turnRate16PerTick);
  if (ship.turnHull === 'F-CA') {
    if (sample.speedHundredths === 500) return scorePoint(ours, 4.65, 'H');
    if (sample.speedHundredths === 1000) return scorePoint(ours, 7.85, 'H');
    if (sample.speedHundredths === 1500) return scorePoint(ours, 7.42, 'H');
    if (sample.speedHundredths === 3050 || sample.speedHundredths === 3100) return scorePoint(ours, 7.29, 'H');
    return scoreNa();
  }
  if (sample.speedHundredths === 500) return scorePoint(ours, 5, 'M');
  if (sample.speedHundredths === 1000) return scorePoint(ours, 8.6, 'M');
  if (sample.speedHundredths === 1500) return scorePoint(ours, 8.4, 'M');
  if (sample.speedHundredths === 2000) return scorePoint(ours, 9.3, 'M');
  if (sample.speedHundredths === 3100) return scorePoint(ours, 9.4, 'M');
  return scoreNa();
}

function hetRateScore(ship: ShipReport, sample: HetSample): Scored {
  const ours = degNumber(sample.turnRate16PerTick);
  if (ship.turnHull === 'F-CA') {
    if (sample.speedHundredths === 3100) return scorePoint(ours, 48, 'H/M');
    return scoreRange(ours, 42, 52, 'H/M');
  }
  return scoreRange(ours, 46, 65, 'L-M');
}

function timeScore(ship: ShipReport, sample: SpeedSample): Scored {
  const seconds = secondsNumber(sample.ticksFromRest);
  const fca: Readonly<Record<number, number>> = {
    500: 11,
    1000: 19,
    1500: 30,
    2000: 43,
    2500: 61,
    3000: 77,
  };
  const d7: Readonly<Record<number, number>> = {
    500: 10,
    1000: 18.5,
    1500: 28,
    2000: 41,
    2500: 57,
    3000: 76,
    3100: 79,
  };
  const table = ship.turnHull === 'F-CA' ? fca : d7;
  const ref = table[sample.speedHundredths];
  if (ref === undefined) return scoreNa();
  return scorePoint(seconds, ref, 'M');
}

function phaserScore(probe: PhaserProbe): Scored {
  if (probe.range <= 2) return scoreRoll(probe.damage, 4, 8, 5, 'M');
  if (probe.range <= 4) return scoreRoll(probe.damage, 3, 6, 4, 'M');
  if (probe.range <= 5) return scoreRoll(probe.damage, 2, 5, 3.5, 'M');
  if (probe.range <= 10) return scoreRoll(probe.damage, 0, 4, 2, 'M');
  if (probe.range <= 15) return scoreRoll(probe.damage, 0, 3, 1, 'M');
  if (probe.range <= 30) return scoreRoll(probe.damage, 0, 2, 0.4, 'M');
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
  if (probe.range <= 2) return scorePoint(points, 8, 'M');
  if (probe.range <= 3) return scorePoint(points, 6.5, 'M');
  if (probe.range <= 5) return scorePoint(points, 5, 'M');
  if (probe.range <= 10) return scorePoint(points, 4, 'M');
  if (probe.range <= 12) return scorePoint(points, 2.5, 'M');
  if (probe.range <= 30) return scorePoint(points, 1, 'M');
  return scoreNone(probe.damage, 'M');
}

function heavyTimeScore(sample: HeavySample): Scored {
  const seconds = secondsNumber(sample.ticksUntilReady);
  if (sample.weapon === PHOTON_CODE) return scorePoint(seconds, 66, 'M');
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
    const delayJudged = ship.turnHull === 'F-CA'
      ? scoreRange(secondsNumber(sample.delayTicks), 1, 1.9, 'H')
      : scoreRange(secondsNumber(sample.delayTicks), 1, 1.8, 'M');
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
    const sweepScore = ship.turnHull === 'F-CA' ? scorePoint(sweep, 89, 'H/M') : scoreRange(sweep, 82, 98, 'L-M');
    rows.push(row(ship.id, 'HET sweep', speedLabel(sample.speedHundredths), `${fixed(sample.sweep16 * 360, 65536, 2)} deg`, sweepScore, 'degrees'));
    const delayScore = ship.turnHull === 'F-CA'
      ? scoreRange(secondsNumber(sample.delayTicks), 5.5, 5.8, 'H/M')
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
        `range ${probe.range}`,
        probe.damage === null ? `none (${probe.reason})` : String(probe.damage),
        phaserScore(probe),
        'damage points on one seeded Ph1 roll, or the reject reason',
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
      row(ship.id, 'photon damage', `range ${probe.range}`, ours, photonScore(probe), 'damage points per tube'),
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
    '- Hulls: F-CA-like uses turn curve `F-CA` and warp 34. K-D7-like uses `K-D7` and warp 39. Actual speed ramps toward the ordered speed on those two hulls. Other hulls still change speed on the order.',
    '- Systems load when life support and fire control are on: 2.5. Movement stays 1 per ordered speed point. Weapon power is plant minus that load.',
    `- Heading order: verb 12, target ${HEADING_TARGET} (90° clockwise), after actual speed has reached the sample.`,
    '- HET: verb 13, starboard. Delay, rate, and sweep are measured from the sim, not copied off the table.',
    `- deg/s = BAM/tick × 10800 / 65536. A full circle is 65536.`,
    `- Phaser: \`${PHASER_CODE}\`, one combat-stream roll per shot. Range 0 is grouped with 1–2. A shared edge stays on the inner band. Nothing past 30.`,
    `- Photon: \`${PHOTON_CODE}\` on the F-CA-like hull. Arming accepts 2 per rules-turn and is ready after ${report.rulesTurnTicks * 2} ticks (two rules-turns), then hold is 1. Damage is hundredths of a point by range.`,
    `- Disruptor: the K-D7-like heavy mount. 2 per rules-turn, ready after ${report.rulesTurnTicks} ticks (one rules-turn), and the same 2 holds it. Overload is 4. Damage is fixed by range. A miss is 0. Normal bands run 0–1, 1.1–2, 2.1–3, 3.1–5, 5.1–16, and 16.1–31k. The cutoff is the measured 31000 range units.`,
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
