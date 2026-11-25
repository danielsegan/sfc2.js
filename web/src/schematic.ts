/**
 * Pure helpers for the docked 4-section Interface Bar:
 * 6 system buttons, Ship Schematic hardpoints & hull silhouettes,
 * target-facing arc geometry, and scan-gated target status.
 */
import type { ContactView, WeaponReadout } from '../../engine/view/view-model.ts';
import type { EmpireId } from './empire-marks.ts';

export type SystemMfdPage =
  | 'weapons'
  | 'shields'
  | 'ew'
  | 'transporters'
  | 'tractors'
  | 'shuttles'
  | 'conversion';

export type SchematicMode = 'mounts' | 'arcs';

export interface SystemButtonDef {
  readonly id: Exclude<SystemMfdPage, 'weapons'>;
  readonly label: string;
  readonly short: string;
  readonly title: string;
  readonly iconPath: string;
}

/** Six left-side system switcher buttons (hud-layout.md §3, CE UI notes §0). */
export const SYSTEM_BUTTONS: readonly SystemButtonDef[] = [
  {
    id: 'shields',
    label: 'Shields',
    short: 'SHD',
    title: 'Shields System MFD',
    iconPath: 'M8 2 L13 4.5 V9.5 L8 14 L3 9.5 V4.5 Z',
  },
  {
    id: 'ew',
    label: 'EW',
    short: 'EW',
    title: 'Electronic Warfare & Cloak MFD',
    iconPath: 'M2 5 Q5 3 8 5 T14 5 M2 8.5 Q5 6.5 8 8.5 T14 8.5 M2 12 Q5 10 8 12 T14 12',
  },
  {
    id: 'transporters',
    label: 'Transporters',
    short: 'TRN',
    title: 'Transporters & Boarding MFD',
    iconPath: 'M5 3 H11 M4 6 H12 M6 9 V13 M10 9 V13 M3 13 H13',
  },
  {
    id: 'tractors',
    label: 'Tractors',
    short: 'TRC',
    title: 'Tractor Beam MFD',
    iconPath: 'M8 2 L13 13 H3 Z M6 9 H10',
  },
  {
    id: 'shuttles',
    label: 'Shuttles',
    short: 'SHT',
    title: 'Shuttles, Fighters & Mines MFD',
    iconPath: 'M8 2 L13 11 L8 9 L3 11 Z M5 13 H11',
  },
  {
    id: 'conversion',
    label: 'Conversion',
    short: 'CNV',
    title: 'Shuttle Conversion MFD',
    iconPath: 'M3 6 H11 L9 4 M13 10 H5 L7 12',
  },
];

export type HardpointZone = 'bow' | 'fwdPort' | 'fwdStbd' | 'center' | 'aft';

export interface HardpointSlot {
  readonly slotIndex: number;
  readonly xPct: number;
  readonly yPct: number;
  readonly zone: HardpointZone;
}

const FULL_16 = 65536;

function arcMid16(from16: number, to16: number): number {
  const from = ((from16 % FULL_16) + FULL_16) % FULL_16;
  const to = ((to16 % FULL_16) + FULL_16) % FULL_16;
  const span = to > from ? to - from : to - from + FULL_16;
  return (from + span / 2) % FULL_16;
}

export function classifyArcZone(weapon: Pick<WeaponReadout, 'arcFull' | 'arcFrom16' | 'arcTo16'>): HardpointZone {
  if (weapon.arcFull) return 'center';
  const deg = (arcMid16(weapon.arcFrom16, weapon.arcTo16) / FULL_16) * 360;
  if (deg <= 35 || deg >= 325) return 'bow';
  if (deg > 35 && deg < 135) return 'fwdStbd';
  if (deg >= 135 && deg <= 225) return 'aft';
  return 'fwdPort';
}

const ZONE_ANCHORS: Readonly<Record<HardpointZone, { x: number; y: number; dx: number; dy: number }>> = {
  bow: { x: 50, y: 27, dx: 24, dy: 0 },
  fwdPort: { x: 27, y: 45, dx: 0, dy: 22 },
  fwdStbd: { x: 73, y: 45, dx: 0, dy: 22 },
  center: { x: 50, y: 51, dx: 24, dy: 0 },
  aft: { x: 50, y: 74, dx: 24, dy: 0 },
};

/** Place weapon hardpoint chips onto the 0..100% schematic box without overlap. */
export function hardpointPositions(
  weapons: readonly Pick<WeaponReadout, 'slotIndex' | 'arcFull' | 'arcFrom16' | 'arcTo16'>[],
): HardpointSlot[] {
  const buckets = new Map<HardpointZone, Pick<WeaponReadout, 'slotIndex' | 'arcFull' | 'arcFrom16' | 'arcTo16'>[]>();
  for (const weapon of weapons) {
    const zone = classifyArcZone(weapon);
    const list = buckets.get(zone) ?? [];
    list.push(weapon);
    buckets.set(zone, list);
  }
  const result: HardpointSlot[] = [];
  for (const weapon of weapons) {
    const zone = classifyArcZone(weapon);
    const group = buckets.get(zone) ?? [weapon];
    const idx = group.indexOf(weapon);
    const offset = idx - (group.length - 1) / 2;
    const anchor = ZONE_ANCHORS[zone];
    result.push({
      slotIndex: weapon.slotIndex,
      xPct: Math.max(14, Math.min(86, anchor.x + offset * anchor.dx)),
      yPct: Math.max(18, Math.min(84, anchor.y + offset * anchor.dy)),
      zone,
    });
  }
  return result;
}

/** SVG path for an arc pie indicator in a 0..20 viewBox (up = bow). */
export function arcPieSvgPath(arcFrom16: number, arcTo16: number, arcFull: boolean): string {
  if (arcFull) return 'M10 10 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0';
  const from = ((arcFrom16 % FULL_16) + FULL_16) % FULL_16;
  const to = ((arcTo16 % FULL_16) + FULL_16) % FULL_16;
  const span = to > from ? to - from : to - from + FULL_16;
  if (span === 0) return '';
  if (span >= FULL_16 - 16) return 'M10 10 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0';
  const a0 = -Math.PI / 2 + (from / FULL_16) * Math.PI * 2;
  const a1 = -Math.PI / 2 + ((from + span) / FULL_16) * Math.PI * 2;
  const x0 = (10 + Math.cos(a0) * 7).toFixed(1);
  const y0 = (10 + Math.sin(a0) * 7).toFixed(1);
  const x1 = (10 + Math.cos(a1) * 7).toFixed(1);
  const y1 = (10 + Math.sin(a1) * 7).toFixed(1);
  const large = span > FULL_16 / 2 ? 1 : 0;
  return `M10 10 L${x0} ${y0} A7 7 0 ${String(large)} 1 ${x1} ${y1} Z`;
}

/**
 * Which of the 6 shield facings (0=bow clockwise) on a ship at `fromPos`
 * with `heading16` is oriented toward `toPos`. Matches engine/sim/arcs.ts.
 */
export function facingTowardPoint(
  heading16: number,
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
): number {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const abs = dx === 0 && dy === 0 ? 0 : (Math.atan2(dy, dx) / (Math.PI * 2)) * FULL_16;
  const rel = (((abs - heading16) % FULL_16) + FULL_16) % FULL_16;
  return Math.floor((rel * 6 + 32768) / FULL_16) % 6;
}

export interface TargetScanStatus {
  readonly lock: 'none' | 'undetected' | 'cloaked' | 'track';
  readonly shieldVisible: boolean;
  readonly scanLabel: string;
  readonly weaponStatusLabel: string;
}

/**
 * Scan-gated target status built purely from existing ViewModel ContactView fields.
 * ContactView does not yet expose `scanQuality` or `weapons` (tracked on issue #145).
 */
export function scanGatedTargetStatus(
  target: Pick<ContactView, 'detected' | 'cloaked' | 'rangeFromSelf'> | null | undefined,
): TargetScanStatus {
  if (!target) {
    return {
      lock: 'none',
      shieldVisible: false,
      scanLabel: 'No target',
      weaponStatusLabel: 'Select a target to inspect shields and scan status.',
    };
  }
  if (!target.detected) {
    return {
      lock: 'undetected',
      shieldVisible: false,
      scanLabel: 'No sensor lock',
      weaponStatusLabel: 'Out of sensor contact — shields and weapon status masked.',
    };
  }
  if (target.cloaked) {
    return {
      lock: 'cloaked',
      shieldVisible: false,
      scanLabel: 'Cloaked',
      weaponStatusLabel: 'Cloak active — target shield ring and weapon scan masked.',
    };
  }
  return {
    lock: 'track',
    shieldVisible: true,
    scanLabel: `Basic track · ${target.rangeFromSelf.toFixed(1)}`,
    weaponStatusLabel: 'Target weapons: awaiting ViewModel ContactView.weapons & scanQuality (issue #145).',
  };
}

/**
 * Original placeholder hull silhouette geometry for schematic canvas drawing
 * in a normalized -1..1 box (bow up at y = -1). Never traced from game art.
 */
export function drawPlaceholderHull(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  empire: EmpireId | string,
  strokeColor: string,
  fillColor?: string,
): void {
  const s = radius * 0.44;
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (empire === 'fed') {
    // Chamfered octagon disc + twin side rails (original placeholder).
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.52, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.52, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.28);
    ctx.lineTo(cx + s * 0.68, cy + s * 0.85);
    ctx.lineTo(cx + s * 0.38, cy + s * 0.85);
    ctx.lineTo(cx + s * 0.14, cy + s * 0.55);
    ctx.lineTo(cx - s * 0.14, cy + s * 0.55);
    ctx.lineTo(cx - s * 0.38, cy + s * 0.85);
    ctx.lineTo(cx - s * 0.68, cy + s * 0.85);
    ctx.lineTo(cx - s * 0.2, cy + s * 0.28);
    ctx.lineTo(cx - s * 0.52, cy + s * 0.05);
    ctx.lineTo(cx - s * 0.52, cy - s * 0.45);
    ctx.closePath();
  } else if (empire === 'kli') {
    // Swept notched wedge (original placeholder).
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.28, cy - s * 0.4);
    ctx.lineTo(cx + s * 0.14, cy + s * 0.18);
    ctx.lineTo(cx + s * 0.9, cy + s * 0.68);
    ctx.lineTo(cx + s * 0.5, cy + s * 0.85);
    ctx.lineTo(cx, cy + s * 0.52);
    ctx.lineTo(cx - s * 0.5, cy + s * 0.85);
    ctx.lineTo(cx - s * 0.9, cy + s * 0.68);
    ctx.lineTo(cx - s * 0.14, cy + s * 0.18);
    ctx.lineTo(cx - s * 0.28, cy - s * 0.4);
    ctx.closePath();
  } else {
    // Plain tactical diamond-delta placeholder.
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.62, cy + s * 0.72);
    ctx.lineTo(cx, cy + s * 0.38);
    ctx.lineTo(cx - s * 0.62, cy + s * 0.72);
    ctx.closePath();
  }
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}
