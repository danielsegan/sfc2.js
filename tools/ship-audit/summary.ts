/**
 * Counts-only summary. Hull values stay in the out directory.
 */
import { columnCounts, isKnownHeader } from "./columns.ts";
import type { CheckResult, HullAudit } from "./derive.ts";
import type { HarnessDiff } from "./harness.ts";
import type { CopyReport } from "./run.ts";

export interface CheckTally {
  pass: number;
  fail: number;
  skip: number;
}

export interface AuditSummary {
  rows: number;
  bindFailed: number;
  checks: {
    shieldTotal: CheckTally;
    powerSum: CheckTally;
    weaponCount: CheckTally;
  };
  shieldScaleDivergent: number;
  columns: { measured: number; assumed: number; unused: number; ignored: number };
  fileColumns: number;
  unmappedColumns: number;
  unmappedNames: string[];
  copies: CopyReport;
  harness: HarnessDiff | null;
}

function emptyTally(): CheckTally {
  return { pass: 0, fail: 0, skip: 0 };
}

function add(tally: CheckTally, check: CheckResult): void {
  tally[check.status] += 1;
}

export function summarize(
  hulls: readonly HullAudit[],
  fileColumns: readonly string[],
  copies: CopyReport,
  harness: HarnessDiff | null,
): AuditSummary {
  const checks = {
    shieldTotal: emptyTally(),
    powerSum: emptyTally(),
    weaponCount: emptyTally(),
  };
  let bindFailed = 0;
  let shieldScaleDivergent = 0;
  for (const hull of hulls) {
    if (hull.bindError) bindFailed += 1;
    if (hull.shieldScaleDivergent) shieldScaleDivergent += 1;
    add(checks.shieldTotal, hull.checks.shieldTotal);
    add(checks.powerSum, hull.checks.powerSum);
    add(checks.weaponCount, hull.checks.weaponCount);
  }
  const unmappedNames: string[] = [];
  for (const name of fileColumns) {
    if (isKnownHeader(name)) continue;
    unmappedNames.push(name === "" ? "(empty)" : name);
  }
  return {
    rows: hulls.length,
    bindFailed,
    checks,
    shieldScaleDivergent,
    columns: columnCounts(),
    fileColumns: fileColumns.length,
    unmappedColumns: unmappedNames.length,
    unmappedNames,
    copies,
    harness,
  };
}

function tallyText(name: string, tally: CheckTally): string {
  return `${name} pass ${tally.pass} fail ${tally.fail} skip ${tally.skip}`;
}

/** Plain-text summary. Counts and column names only. */
export function formatSummary(summary: AuditSummary): string {
  const lines = [
    "ship-audit",
    `rows ${summary.rows}`,
    `bindFailed ${summary.bindFailed}`,
    tallyText("checks.shieldTotal", summary.checks.shieldTotal),
    tallyText("checks.powerSum", summary.checks.powerSum),
    tallyText("checks.weaponCount", summary.checks.weaponCount),
    `shieldScale.engineNotOneToOne ${summary.shieldScaleDivergent}`,
    `columns.measured ${summary.columns.measured}`,
    `columns.assumed ${summary.columns.assumed}`,
    `columns.unused ${summary.columns.unused}`,
    `columns.ignored ${summary.columns.ignored}`,
    `file.columns ${summary.fileColumns}`,
    `file.unmapped ${summary.unmappedColumns}`,
  ];
  if (summary.unmappedNames.length > 0) lines.push(`file.unmappedNames ${summary.unmappedNames.join(",")}`);
  lines.push(`copiesDiffer ${summary.copies.differ}`);
  lines.push(`copies.note ${summary.copies.note}`);
  if (summary.copies.note !== "not compared (one file)") {
    lines.push(`copies.assetsRows ${summary.copies.assetsRows}`);
    lines.push(`copies.metaRows ${summary.copies.metaRows}`);
    lines.push(`copies.assetsColumns ${summary.copies.assetsColumns}`);
    lines.push(`copies.metaColumns ${summary.copies.metaColumns}`);
    lines.push(`copies.onlyInOne ${summary.copies.onlyInOne}`);
    lines.push(`copies.rowsDiffer ${summary.copies.rowsDiffer}`);
    lines.push(`copies.headerNamesDiffer ${summary.copies.headerNamesDiffer}`);
    lines.push(`copies.columnsDiffer ${summary.copies.columnsDiffer}`);
  }
  if (summary.harness === null) {
    lines.push("harness off");
  } else {
    lines.push(`harness.runs ${summary.harness.runs}`);
    lines.push(`harness.unmatched ${summary.harness.unmatched}`);
    lines.push(`harness.turnUntagged ${summary.harness.turnUntagged}`);
    lines.push(`harness.turnNoSpeed ${summary.harness.turnNoSpeed}`);
    const names = Object.keys(summary.harness.fields).sort();
    for (const name of names) {
      const tally = summary.harness.fields[name];
      if (!tally) continue;
      lines.push(tallyText(`harness.fields.${name}`, tally));
    }
  }
  return `${lines.join("\n")}\n`;
}

export function summaryFailed(summary: AuditSummary): boolean {
  if (summary.bindFailed > 0) return true;
  const checks = [summary.checks.shieldTotal, summary.checks.powerSum, summary.checks.weaponCount];
  if (checks.some((check) => check.fail > 0)) return true;
  if (summary.harness && summary.harness.unmatched > 0) return true;
  if (summary.harness) {
    for (const tally of Object.values(summary.harness.fields)) {
      if (tally.fail > 0) return true;
    }
  }
  return false;
}
