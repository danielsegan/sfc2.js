/**
 * Beam lines from events that already name a shooter, a target, and a
 * weapon family. A hit that only names the victim is a shield flash,
 * not a beam (hud-layout.md §7.4).
 */
import { beamFamilyColor } from './tokens.ts';

export interface BeamReport {
  readonly shooter: number;
  readonly target: number;
  readonly family: string;
  readonly color: number;
}

export function reportedBeams(events: readonly object[]): BeamReport[] {
  const beams: BeamReport[] = [];
  for (const event of events) {
    if (typeof event !== 'object' || event === null) continue;
    const record = event as { kind?: unknown; shooter?: unknown; target?: unknown; family?: unknown };
    if (record.kind !== 'beam' && record.kind !== 'fire') continue;
    if (typeof record.shooter !== 'number' || typeof record.target !== 'number' || typeof record.family !== 'string') continue;
    const color = beamFamilyColor(record.family);
    if (color === null) continue;
    beams.push({ shooter: record.shooter, target: record.target, family: record.family, color });
  }
  return beams;
}

export interface HitFlash {
  readonly ship: number;
  readonly facing: number;
}

export function reportedFlashes(events: readonly object[]): HitFlash[] {
  const flashes: HitFlash[] = [];
  for (const event of events) {
    if (typeof event !== 'object' || event === null) continue;
    const record = event as { kind?: unknown; ship?: unknown; facing?: unknown };
    if (record.kind !== 'hit') continue;
    if (typeof record.ship !== 'number' || typeof record.facing !== 'number') continue;
    if (record.facing < 0 || record.facing > 5) continue;
    flashes.push({ ship: record.ship, facing: record.facing });
  }
  return flashes;
}
