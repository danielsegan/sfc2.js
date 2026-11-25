/**
 * Text forms of a metrics report. Degrees and seconds are exact integer
 * ratios printed to 4 decimal places, so the table does not depend on
 * floating-point formatting.
 */
import { HEADING_TARGET, PHASER_CODE, PHOTON_CODE } from './ships.ts';
import type { EnergySample, MetricsReport, ShipReport, TurnSample } from './run.ts';

export interface TableRow {
  readonly ship: string;
  readonly metric: string;
  readonly case: string;
  readonly value: string;
  readonly unit: string;
}

function fixed(numerator: number, denominator: number, places: number): string {
  if (denominator <= 0 || !Number.isInteger(numerator) || !Number.isInteger(denominator)) throw new Error('ratio');
  const scale = 10 ** places;
  const rounded = Math.floor((numerator * scale + Math.floor(denominator / 2)) / denominator);
  const whole = Math.floor(rounded / scale);
  const frac = String(rounded % scale).padStart(places, '0');
  return `${whole}.${frac}`;
}

/** Inverse of the turn table's rounding: rate × 360 × 30 / 65536. */
export function degPerSec(rate16: number): string {
  return fixed(rate16 * 10800, 65536, 4);
}

export function ticksToSeconds(ticks: number): string {
  return fixed(ticks, 30, 4);
}

function turnValue(sample: TurnSample): string {
  return `${sample.turnRate16PerTick} BAM/tick = ${degPerSec(sample.turnRate16PerTick)} deg/s`;
}

function delayValue(ticks: number): string {
  const noun = ticks === 1 ? 'tick' : 'ticks';
  return `${ticks} ${noun} = ${ticksToSeconds(ticks)} s`;
}

function energyPoint(sample: EnergySample): string {
  return `${sample.perSpeedPointNumerator}/${sample.perSpeedPointDenominator}`;
}

function energyTick(sample: EnergySample): string {
  return `${sample.perTickNumerator}/${sample.perTickDenominator}`;
}

export function tableRows(report: MetricsReport): readonly TableRow[] {
  const rows: TableRow[] = [];
  for (const ship of report.ships) pushShip(rows, ship);
  return rows;
}

function pushShip(rows: TableRow[], ship: ShipReport): void {
  for (const sample of ship.turns) {
    rows.push({
      ship: ship.id,
      metric: 'turn rate',
      case: `speed ${sample.speed}`,
      value: turnValue(sample),
      unit: 'BAM/tick and deg/s at 30 Hz',
    });
    rows.push({
      ship: ship.id,
      metric: 'order-to-turn delay',
      case: `speed ${sample.speed}`,
      value: delayValue(sample.delayTicks),
      unit: 'ticks from verb 12 apply until the first heading change',
    });
  }
  for (const sample of ship.timeToSpeed) {
    rows.push({
      ship: ship.id,
      metric: 'time to speed',
      case: `speed ${sample.speed}`,
      value: `${delayValue(sample.ticksFromFirstApply)}; trace ${sample.trace.join(',')}`,
      unit: 'ticks from the first setEnergy apply until ordered speed equals the target',
    });
  }
  for (const sample of ship.energy) {
    rows.push({
      ship: ship.id,
      metric: 'movement energy',
      case: `speed ${sample.speed}`,
      value: `${sample.rulePointsPerRulesTurn} per rules-turn; ${energyPoint(sample)} per speed point; ${energyTick(sample)} per tick`,
      unit: 'rule points (per rules-turn, per speed point per rules-turn, per tick)',
    });
  }
  for (const probe of ship.phaser) {
    rows.push({
      ship: ship.id,
      metric: 'phaser damage',
      case: `band ${probe.band}, range ${probe.range}`,
      value: probe.damage === null ? `none (${probe.reason})` : String(probe.damage),
      unit: 'damage points on a hit, or the reject reason',
    });
  }
  rows.push({
    ship: ship.id,
    metric: 'heavy arm cost',
    case: `${ship.heavy.weapon} normal`,
    value: `${ship.heavy.energyPaidRulePoints} paid; catalog ${ship.heavy.catalogArmCost}`,
    unit: 'rule points',
  });
  rows.push({
    ship: ship.id,
    metric: 'heavy arm time',
    case: `${ship.heavy.weapon} normal`,
    value: `${delayValue(ship.heavy.ticksUntilReady)}; catalog arm ticks ${ship.heavy.catalogArmTicks}`,
    unit: 'ticks from setEnergy apply until the mount is ready, inclusive',
  });
  for (const shot of ship.shields) {
    rows.push({
      ship: ship.id,
      metric: 'shield facing',
      case: `incoming bearing ${shot.bearing16}`,
      value: String(shot.facing),
      unit: 'facing index, 0 = bow, clockwise',
    });
  }
  for (const sample of ship.firepower) {
    rows.push({
      ship: ship.id,
      metric: 'power left for weapons',
      case: `speed ${sample.speed}`,
      value: String(sample.weaponRulePoints),
      unit: 'rule points per rules-turn after life support, fire control, and movement',
    });
  }
}

function scenarioText(report: MetricsReport): string {
  return [
    '# Duel metrics',
    '',
    'Headless Phase 2 sim on synthetic hulls. These numbers are what this build does.',
    'They are not a capture from the original game. A private VM can compare them with one.',
    '',
    '## Scenario',
    '',
    `- Tick rate: ${report.tickHz} Hz. One second is ${report.tickHz} ticks. \`step\` has no dt.`,
    `- Rules-turn: ${report.rulesTurnTicks} ticks (${report.rulesTurnTicks / report.tickHz} s). Placeholder from the duel-slice constants.`,
    `- Input delay: ${report.inputDelay}. A player order is stamped for the next tick. Seed ${report.seed} (0x${report.seed.toString(16)}).`,
    `- Hulls: F-CA-like uses turn curve \`F-CA\`. K-D7-like uses \`K-D7\`. Turn letter is C, whose fallback cap sits above the curve, so the curve rate is the one applied.`,
    `- Plant, both hulls: warp ${report.warp}, impulse 0, APR 0, battery 0. Move cost ${report.moveCostRulePoints} rule point per speed point per rules-turn. Acceleration ${report.acceleration} speed points per setEnergy.`,
    `- Heading order: verb ${report.headingVerb}, target heading ${HEADING_TARGET} (90° clockwise). This is the duel match's heading order, not the instant yaw verb.`,
    `- Speed order: verb ${report.energyVerb} (\`setEnergy\`), reissued every tick until ordered speed equals the target. Life support and fire control are off for the movement-energy probe.`,
    `- Turn delay: ticks from the tick verb ${report.headingVerb} applies until the heading first changes. The rate is the BAM change on that tick and on the next tick.`,
    `- deg/s = BAM/tick × 10800 / 65536, printed to 4 decimal places. 65536 BAM is one full turn.`,
    `- Phaser: \`${PHASER_CODE}\` on arc ALL, pre-charged, fire control already paid. The row omits its own cost, so the sim uses the phaser cost fallback. Probes are whole range units on +x. Band 26+ is probed at 26 and 30.`,
    `- Heavy weapon: \`${PHOTON_CODE}\` normal mode. Catalog arm cost and arm ticks are the photon cost fallback. Measured time is how long the rules-turn drip takes to make the mount ready.`,
    `- Shields: shooter at (0, 0) heading 0, target at (8, 0). Target heading is (32768 − bearing) mod 65536, so the incoming relative bearing is the listed uint16. Bearing 0 is the bow center. The other five are the centers of the clockwise bins.`,
    '- Weapon power: life support and fire control on (1 each), general shields 0, ten uncharged phasers asking for 100 each. The figure is the weapon budget actually paid.',
    '',
  ].join('\n');
}

function markdownTable(rows: readonly TableRow[]): string {
  const header = '| Ship | Metric | Case | Value | Unit |';
  const rule = '| --- | --- | --- | --- | --- |';
  const body = rows.map((row) => `| ${row.ship} | ${row.metric} | ${row.case} | ${row.value} | ${row.unit} |`);
  return [header, rule, ...body, ''].join('\n');
}

export function renderMarkdown(report: MetricsReport): string {
  return `${scenarioText(report)}\n${markdownTable(tableRows(report))}`;
}

export function renderJson(report: MetricsReport): string {
  return JSON.stringify(report, null, 2);
}
