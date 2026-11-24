/**
 * Shared integer lookup for per-hull, speed-keyed turn tables
 * (docs/rules/data/turn-normal.json and docs/rules/data/het.json).
 * Fixed-point interpolation, no floats. The engine must not import this file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

/** Floor division toward -∞, matching engine/sim/rules-div integer style. */
export function intFloorDiv(n, d) {
  const q = Math.trunc(n / d);
  return n !== 0 && (n < 0) !== (d < 0) && q * d !== n ? q - 1 : q;
}

/**
 * Linear interpolation with symmetric nearest-integer rounding
 * (same formula as docs/rules/het.md and the rules fixture checker).
 */
export function interpInt(s, s0, y0, s1, y1) {
  const dx = s1 - s0;
  const t = s - s0;
  const num = (y1 - y0) * t;
  const half = dx >> 1;
  if (num >= 0) return y0 + intFloorDiv(num + half, dx);
  return y0 - intFloorDiv(-num + half, dx);
}

export function divNearest(n, d) {
  if (d === 0) throw new Error("turn-curve divisor");
  const half = d >> 1;
  if (n >= 0) return intFloorDiv(n + half, d);
  return -intFloorDiv(-n + half, d);
}

/** round(degPerSec × 65536 / 10800) from deg/s hundredths. */
export function rate16FromDegHundredths(degHundredths) {
  return divNearest(degHundredths * 65536, 1_080_000);
}

/** round(seconds × 30) from seconds hundredths. */
export function delayTicksFromSecondsHundredths(secondsHundredths) {
  return divNearest(secondsHundredths * 30, 100);
}

export function pointSpeedHundredths(point) {
  if (Number.isInteger(point.speedHundredths)) return point.speedHundredths;
  if (Number.isInteger(point.speed)) return point.speed * 100;
  throw new Error("turn-curve speed point is missing an integer speed key");
}

export function speedToHundredths(speed) {
  return Math.round(speed * 100);
}

/**
 * Look up (and interpolate or clamp) a hull's speed point.
 * Unknown hulls use table.hulls.default when present.
 */
export function lookupTurnPoint(table, hullKey, speedHundredths) {
  const entry = table.hulls[hullKey] ?? table.hulls.default;
  if (!entry) throw new Error(`turn-curve missing hull ${hullKey}`);
  const pts = entry.speedPoints;
  if (!pts?.length) throw new Error(`turn-curve missing speedPoints for ${hullKey}`);
  const q = speedHundredths | 0;
  const firstQ = pointSpeedHundredths(pts[0]);
  if (q <= firstQ) return pts[0];
  const last = pts[pts.length - 1];
  const lastQ = pointSpeedHundredths(last);
  if (q >= lastQ) return last;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const aQ = pointSpeedHundredths(a);
    const bQ = pointSpeedHundredths(b);
    if (q === aQ) return a;
    if (q === bQ) return b;
    if (q > aQ && q < bQ) {
      const out = {
        speedHundredths: q,
        delayTicks: interpInt(q, aQ, a.delayTicks, bQ, b.delayTicks),
        turnRate16PerTick: interpInt(q, aQ, a.turnRate16PerTick, bQ, b.turnRate16PerTick),
      };
      if (Number.isInteger(a.turnAngle16) && Number.isInteger(b.turnAngle16)) {
        out.turnAngle16 = interpInt(q, aQ, a.turnAngle16, bQ, b.turnAngle16);
      }
      if (q % 100 === 0) out.speed = q / 100;
      return out;
    }
  }
  return last;
}

const FIELD_RE = /^turn\.(normal|het)\.(\d+(?:\.\d+)?)\.(degPerSecond|delayS|deg)$/;

export function parseTurnField(field) {
  const match = FIELD_RE.exec(field);
  if (!match) return null;
  return { kind: match[1], speedText: match[2], speed: Number(match[2]), metric: match[3] };
}

function hundredthsOf(value) {
  return Math.round(value * 100);
}

function expectMap(entry) {
  const expect = entry?.audit?.expect;
  const tolerances = entry?.audit?.tolerances;
  if (!expect) return null;
  return { expect, tolerances: tolerances ?? {} };
}

function metricAtSpeed(expect, kind, metric, speedText) {
  const key = `turn.${kind}.${speedText}.${metric}`;
  if (Object.prototype.hasOwnProperty.call(expect, key)) return expect[key];
  return undefined;
}

function nearestExpectPair(expect, kind, metric, speedHundredths) {
  const rows = [];
  const prefix = `turn.${kind}.`;
  const suffix = `.${metric}`;
  for (const [key, value] of Object.entries(expect)) {
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const mid = key.slice(prefix.length, key.length - suffix.length);
    if (!/^\d+(?:\.\d+)?$/.test(mid)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    rows.push({ q: Math.round(Number(mid) * 100), speedText: mid, value });
  }
  rows.sort((a, b) => a.q - b.q);
  if (rows.length === 0) return null;
  if (speedHundredths <= rows[0].q) return { value: rows[0].value, exact: rows[0].q === speedHundredths, key: `turn.${kind}.${rows[0].speedText}.${metric}` };
  const last = rows[rows.length - 1];
  if (speedHundredths >= last.q) return { value: last.value, exact: last.q === speedHundredths, key: `turn.${kind}.${last.speedText}.${metric}` };
  for (let i = 0; i < rows.length - 1; i += 1) {
    const a = rows[i];
    const b = rows[i + 1];
    if (speedHundredths === a.q) return { value: a.value, exact: true, key: `turn.${kind}.${a.speedText}.${metric}` };
    if (speedHundredths === b.q) return { value: b.value, exact: true, key: `turn.${kind}.${b.speedText}.${metric}` };
    if (speedHundredths > a.q && speedHundredths < b.q) {
      const value = interpInt(speedHundredths, a.q, hundredthsOf(a.value), b.q, hundredthsOf(b.value)) / 100;
      return { value, exact: false, key: null };
    }
  }
  return { value: last.value, exact: false, key: `turn.${kind}.${last.speedText}.${metric}` };
}

export function resolveHullKey(table, candidates) {
  const keys = [];
  for (const raw of candidates) {
    if (typeof raw !== "string" || raw === "") continue;
    keys.push(raw);
    const slash = raw.lastIndexOf(":");
    if (slash >= 0 && slash < raw.length - 1) keys.push(raw.slice(slash + 1));
  }
  for (const key of keys) {
    if (key !== "default" && table.hulls?.[key]) return key;
  }
  return null;
}

let cachedTables = null;

export function loadTurnTables() {
  if (!cachedTables) {
    cachedTables = {
      normal: readJson("docs/rules/data/turn-normal.json"),
      het: readJson("docs/rules/data/het.json"),
    };
  }
  return cachedTables;
}

/**
 * Audit expect/tolerance for a turn.* field from the rules tables.
 * Returns undefined when the hull or field has no table expect (the audit skips).
 * The default fallback hull is never auto-scored.
 */
export function tableExpectForTurnField(hullKeys, field) {
  const parsed = parseTurnField(field);
  if (!parsed) return undefined;
  const tables = loadTurnTables();
  const table = parsed.kind === "het" ? tables.het : tables.normal;
  const hullKey = resolveHullKey(table, hullKeys);
  if (!hullKey) return undefined;
  const entry = table.hulls[hullKey];
  const maps = expectMap(entry);
  if (!maps) return undefined;
  const q = speedToHundredths(parsed.speed);
  const exactKey = `turn.${parsed.kind}.${parsed.speedText}.${parsed.metric}`;
  if (Object.prototype.hasOwnProperty.call(maps.expect, exactKey)) {
    const tolerance = Object.prototype.hasOwnProperty.call(maps.tolerances, exactKey)
      ? maps.tolerances[exactKey]
      : undefined;
    return { value: maps.expect[exactKey], tolerance };
  }
  const pair = nearestExpectPair(maps.expect, parsed.kind, parsed.metric, q);
  if (!pair) return undefined;
  let tolerance;
  if (pair.key && Object.prototype.hasOwnProperty.call(maps.tolerances, pair.key)) {
    tolerance = maps.tolerances[pair.key];
  } else {
    const any = Object.entries(maps.tolerances).find(([key]) => key.endsWith(`.${parsed.metric}`));
    if (any) tolerance = any[1];
  }
  return { value: pair.value, tolerance };
}
