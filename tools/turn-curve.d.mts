/** Shared integer lookup for per-hull, speed-keyed turn tables. */
export function intFloorDiv(n: number, d: number): number;
export function interpInt(s: number, s0: number, y0: number, s1: number, y1: number): number;
export function divNearest(n: number, d: number): number;
export function rate16FromDegHundredths(degHundredths: number): number;
export function delayTicksFromSecondsHundredths(secondsHundredths: number): number;
export function pointSpeedHundredths(point: { speedHundredths?: number; speed?: number }): number;
export function speedToHundredths(speed: number): number;
export function lookupTurnPoint(
  table: { hulls: Record<string, { speedPoints: Record<string, number>[] }> },
  hullKey: string,
  speedHundredths: number,
): {
  speed?: number;
  speedHundredths?: number;
  delayTicks: number;
  turnRate16PerTick: number;
  turnAngle16?: number;
};
export function parseTurnField(
  field: string,
): { kind: "normal" | "het"; speedText: string; speed: number; metric: "degPerSecond" | "delayS" | "deg" } | null;
export function resolveHullKey(table: { hulls?: Record<string, unknown> }, candidates: readonly unknown[]): string | null;
export function loadTurnTables(): { normal: object; het: object };
export function tableExpectForTurnField(
  hullKeys: readonly unknown[],
  field: string,
): { value: number; tolerance?: number } | undefined;
