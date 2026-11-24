/**
 * Per-hull JSON and CSV. These files hold derived numbers and stay on the machine
 * that read the install. The summary writer does not call this for stdout.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HullAudit } from "./derive.ts";
import type { AuditSummary } from "./summary.ts";

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function weaponCell(hull: HullAudit): string {
  return hull.weapons
    .map((weapon) =>
      [weapon.fileSlot, weapon.weapon, weapon.arc ?? "", weapon.count ?? "", weapon.reloads ?? "", weapon.boxes ?? ""].join(":"),
    )
    .join(";");
}

const CSV_HEADERS = [
  "spawnKey",
  "line",
  "shield0",
  "shield1",
  "shield2",
  "shield3",
  "shield4",
  "shield5",
  "measured0",
  "measured1",
  "measured2",
  "measured3",
  "measured4",
  "measured5",
  "shieldTotal",
  "turn",
  "yawPerTick",
  "degPerGameSecond",
  "speed",
  "cruiseSpeed",
  "acceleration",
  "moveCost100",
  "warp",
  "impulse",
  "apr",
  "battery",
  "generation",
  "armor",
  "hullForward",
  "hullCenter",
  "hullAft",
  "simArmor",
  "crew",
  "minCrew",
  "weapons",
  "shieldTotalCheck",
  "powerSumCheck",
  "weaponCountCheck",
  "bindError",
  "shieldScaleDivergent",
] as const;

function rowCells(hull: HullAudit): Array<string | number | null> {
  const shield = (index: number, source: readonly number[]): number | null =>
    index < source.length ? (source[index] ?? null) : null;
  return [
    hull.spawnKey,
    hull.line,
    shield(0, hull.shields),
    shield(1, hull.shields),
    shield(2, hull.shields),
    shield(3, hull.shields),
    shield(4, hull.shields),
    shield(5, hull.shields),
    shield(0, hull.shieldsMeasured),
    shield(1, hull.shieldsMeasured),
    shield(2, hull.shieldsMeasured),
    shield(3, hull.shieldsMeasured),
    shield(4, hull.shieldsMeasured),
    shield(5, hull.shieldsMeasured),
    hull.shieldFile?.total ?? null,
    hull.turn.letter,
    hull.turn.yawPerTick,
    hull.turn.degPerGameSecond,
    hull.speed,
    hull.cruiseSpeed,
    hull.acceleration,
    hull.moveCost100,
    hull.power?.warp ?? null,
    hull.power?.impulse ?? null,
    hull.power?.apr ?? null,
    hull.power?.battery ?? null,
    hull.power?.generation ?? null,
    hull.hull.armor,
    hull.hull.forward,
    hull.hull.center,
    hull.hull.aft,
    hull.simHull.armor,
    hull.crew.crew,
    hull.crew.minCrew,
    weaponCell(hull),
    hull.checks.shieldTotal.status,
    hull.checks.powerSum.status,
    hull.checks.weaponCount.status,
    hull.bindError ? 1 : 0,
    hull.shieldScaleDivergent ? 1 : 0,
  ];
}

export function hullsToCsv(hulls: readonly HullAudit[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const hull of hulls) lines.push(rowCells(hull).map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

export async function writeAuditOutput(dir: string, hulls: readonly HullAudit[], summary: AuditSummary): Promise<void> {
  await mkdir(dir, { recursive: true });
  const body = {
    private: true,
    note: "Derived on this machine. Do not commit or upload.",
    hulls,
  };
  await writeFile(path.join(dir, "hulls.json"), `${JSON.stringify(body, null, 1)}\n`, "utf8");
  await writeFile(path.join(dir, "hulls.csv"), hullsToCsv(hulls), "utf8");
  await writeFile(path.join(dir, "summary.json"), `${JSON.stringify(summary, null, 1)}\n`, "utf8");
}
