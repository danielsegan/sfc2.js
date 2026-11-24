/**
 * Diff a tools/ce-harness results-*.json file against derived hull fields.
 * The summarize.py envelope is { source, method, heading_convention, runs[] }.
 * A run may add spawnKey and fields. Numbers in the file are not printed.
 */
import { derivedFields, type HullAudit } from "./derive.ts";

export interface FieldTally {
  pass: number;
  fail: number;
  skip: number;
}

export interface HarnessDiff {
  runs: number;
  unmatched: number;
  /** Turn samples with a rate, delay, or swept angle and no normal|het kind. Skipped, not failed. */
  turnUntagged: number;
  /** Tagged turn samples with no target or settled speed. Skipped, not failed. */
  turnNoSpeed: number;
  fields: Record<string, FieldTally>;
}

interface RunRecord {
  label?: unknown;
  spawnKey?: unknown;
  hull?: unknown;
  energy_panel?: unknown;
  mean_rate_deg_per_game_s_10_90?: unknown;
  total_turn_deg?: unknown;
  order_delay_s?: unknown;
  target_speed?: unknown;
  settled_speed?: unknown;
  /** `normal` or `het`. A string. Legacy captures omit it. */
  turn?: unknown;
  turnKind?: unknown;
  kind?: unknown;
  fields?: unknown;
  expect?: unknown;
  tolerances?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function tally(): FieldTally {
  return { pass: 0, fail: 0, skip: 0 };
}

function bump(map: Record<string, FieldTally>, field: string, kind: keyof FieldTally): void {
  const row = map[field] ?? tally();
  row[kind] += 1;
  map[field] = row;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asMap(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const n = asNumber(item);
    if (n !== null) out[key] = n;
  }
  return out;
}

function labelPrefix(label: string): string {
  const match = /^(.*)-\d+(?:\.\d+)?$/.exec(label);
  return match?.[1] && match[1] !== "" ? match[1] : label;
}

function resolveKey(run: RunRecord, hulls: readonly HullAudit[], hullMap: Readonly<Record<string, string>>): string | null {
  if (typeof run.spawnKey === "string" && run.spawnKey !== "") return run.spawnKey;
  if (typeof run.hull === "string" && run.hull !== "") return run.hull;
  const label = typeof run.label === "string" ? run.label : "";
  if (label !== "" && hulls.some((hull) => hull.spawnKey === label)) return label;
  if (label !== "" && Object.prototype.hasOwnProperty.call(hullMap, label)) return hullMap[label] ?? null;
  const prefix = label === "" ? "" : labelPrefix(label);
  if (prefix !== "" && Object.prototype.hasOwnProperty.call(hullMap, prefix)) return hullMap[prefix] ?? null;
  return null;
}

function measuredOf(run: RunRecord): Record<string, number> {
  const out: Record<string, number> = {};
  const energy = isRecord(run.energy_panel) ? asNumber(run.energy_panel.power) : null;
  if (energy !== null) out["power.generation"] = energy;
  const extra = asMap(run.fields);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) out[key] = value;
  }
  return out;
}

function turnKind(run: RunRecord): "normal" | "het" | null {
  const candidates = [run.turnKind, run.kind, run.turn];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const text = candidate.trim().toLowerCase();
    if (text === "normal" || text === "het") return text;
  }
  return null;
}

function speedKey(run: RunRecord): string | null {
  const speed = asNumber(run.target_speed) ?? asNumber(run.settled_speed);
  if (speed === null) return null;
  if (Number.isInteger(speed)) return String(speed);
  return String(speed);
}

function isTurnSample(run: RunRecord): boolean {
  return (
    asNumber(run.mean_rate_deg_per_game_s_10_90) !== null ||
    asNumber(run.order_delay_s) !== null ||
    asNumber(run.total_turn_deg) !== null
  );
}

/**
 * Normal turns and High-Energy Turns are different measurements.
 * Untagged legacy rows are not scored against yaw.
 */
function turnFields(run: RunRecord): { untagged: boolean; noSpeed: boolean; fields: Record<string, number> } {
  const fields: Record<string, number> = {};
  if (!isTurnSample(run)) return { untagged: false, noSpeed: false, fields };
  const kind = turnKind(run);
  if (kind === null) return { untagged: true, noSpeed: false, fields };
  const speed = speedKey(run);
  if (speed === null) return { untagged: false, noSpeed: true, fields };
  const rate = asNumber(run.mean_rate_deg_per_game_s_10_90);
  const delay = asNumber(run.order_delay_s);
  if (kind === "normal") {
    if (rate !== null) fields[`turn.normal.${speed}.degPerSecond`] = rate;
    if (delay !== null) fields[`turn.normal.${speed}.delayS`] = delay;
  } else {
    const swept = asNumber(run.total_turn_deg);
    if (swept !== null) fields[`turn.het.${speed}.deg`] = swept;
    if (rate !== null) fields[`turn.het.${speed}.degPerSecond`] = rate;
    if (delay !== null) fields[`turn.het.${speed}.delayS`] = delay;
  }
  return { untagged: false, noSpeed: false, fields };
}

/**
 * Accept the summarize.py object. Throws a short error that does not quote the file.
 */
export function parseHarness(value: unknown): { runs: RunRecord[]; tolerances: Record<string, number> } {
  if (!isRecord(value) || !Array.isArray(value.runs)) throw new Error("harness JSON must contain a runs array");
  const tolerances = asMap(value.tolerances) ?? {};
  return { runs: value.runs as RunRecord[], tolerances };
}

export function diffHarness(
  hulls: readonly HullAudit[],
  document: unknown,
  hullMap: Readonly<Record<string, string>>,
  tolerance: number,
  turnTolerance: number,
): HarnessDiff {
  const parsed = parseHarness(document);
  const fields: Record<string, FieldTally> = {};
  let unmatched = 0;
  let turnUntagged = 0;
  let turnNoSpeed = 0;
  for (const run of parsed.runs) {
    const turns = turnFields(run);
    if (turns.untagged) turnUntagged += 1;
    if (turns.noSpeed) turnNoSpeed += 1;
    const key = resolveKey(run, hulls, hullMap);
    const hull = key === null ? undefined : hulls.find((item) => item.spawnKey === key);
    if (!hull) {
      unmatched += 1;
      continue;
    }
    const derived = derivedFields(hull);
    const expect = asMap(run.expect) ?? {};
    const measured = { ...measuredOf(run), ...turns.fields };
    const runTol = asMap(run.tolerances) ?? {};
    for (const [field, value] of Object.entries(measured)) {
      const expected = Object.prototype.hasOwnProperty.call(expect, field) ? expect[field] : derived[field];
      if (expected === undefined) {
        bump(fields, field, "skip");
        continue;
      }
      const limit =
        runTol[field] ?? parsed.tolerances[field] ?? (field.startsWith("turn.") ? turnTolerance : tolerance);
      const delta = value > expected ? value - expected : expected - value;
      bump(fields, field, delta <= limit + 1e-9 ? "pass" : "fail");
    }
  }
  return { runs: parsed.runs.length, unmatched, turnUntagged, turnNoSpeed, fields };
}
