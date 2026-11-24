import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import measured from "../../docs/rules/data/measured.json" with { type: "json" };
import { CE_HEADERS, FIELD_COLUMNS, columnCounts, isKnownHeader, renderFieldMap } from "./columns.ts";
import { auditText, readInstallShiplist } from "./run.ts";
import { formatSummary, summaryFailed } from "./summary.ts";
import { yawToDegPerGameSecond } from "./derive.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rowsPath = path.join(root, "tools/fixtures/ship-audit/rows.txt");
const harnessPath = path.join(root, "tools/fixtures/ship-audit/results-test.json");
const mapPath = path.join(root, "docs/formats/shiplist-field-map.md");

function inventoryHeaders(): string[] {
  const text = fs.readFileSync(path.join(root, "docs/formats/inventory/shiplist-ftrlist-ce-2.670.md"), "utf8");
  const chunk = text.slice(text.indexOf("- Header names:"), text.indexOf("### Uniqueness"));
  const names: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("  - `") && line.endsWith("`")) names.push(line.slice(5, -1));
    else if (line.startsWith("  - ``")) names.push("");
  }
  return names;
}

test("field map covers every CE header and matches the committed doc", () => {
  assert.deepEqual(CE_HEADERS, inventoryHeaders());
  assert.equal(FIELD_COLUMNS.length, 190);
  assert.equal(fs.readFileSync(mapPath, "utf8"), renderFieldMap());
  const counts = columnCounts();
  assert.equal(counts.measured, 5);
  assert.equal(counts.measured + counts.assumed + counts.unused, 190);
  const ignored = new Set(FIELD_COLUMNS.filter((column) => column.ignored).map((column) => column.index));
  for (let index = 155; index <= 179; index++) assert.equal(ignored.has(index), true);
  assert.equal(ignored.has(107), true);
  assert.equal(ignored.has(108), true);
  assert.equal(ignored.has(121), true);
  assert.equal(ignored.has(154), true);
  assert.equal(ignored.has(24), true);
  for (const index of [20, 21, 22, 23]) {
    const column = FIELD_COLUMNS[index];
    assert.equal(column?.status, "measured");
    assert.equal(column?.ignored, false);
    assert.match(column?.transform ?? "", /1:1/);
    assert.match(column?.transform ?? "", /no ×2/);
  }
  assert.match(renderFieldMap(), /Shield Total = Shield 1 \+ 2×Shield 2 _ 6 \+ 2×Shield 3 _ 5 \+ Shield 4/);
  assert.equal(measured.shields.fallbackEndFactor, 2);
  assert.equal(measured.shields.fallbackSideColumnFactor, 2);
  assert.equal(measured.shields.endFactor, 1);
  assert.equal(measured.shields.sideColumnFactor, 1);
});

test("synthetic rows exercise shield, power, and weapon checks", () => {
  const text = fs.readFileSync(rowsPath, "utf8");
  const harness = JSON.parse(fs.readFileSync(harnessPath, "utf8")) as unknown;
  const { hulls, summary } = auditText(text, { harness, tolerance: 0, turnTolerance: 1 });
  const byName = new Map(hulls.map((hull) => [hull.spawnKey, hull]));
  const good = byName.get("Federation:TEST-CA-01");
  assert.ok(good);
  assert.deepEqual(good.shields, [10, 8, 6, 4, 6, 8]);
  assert.deepEqual(good.shieldsMeasured, [10, 8, 6, 4, 6, 8]);
  assert.equal(good.shieldScaleDivergent, false);
  assert.equal(good.power?.warp, 13);
  assert.equal(good.power?.generation, 19);
  assert.equal(good.cruiseSpeed, 19);
  assert.equal(good.speed, 0);
  assert.equal(good.crew.crew, 20);
  assert.equal(good.hull.armor, 7);
  assert.equal(good.simHull.armor, 0);
  assert.equal(good.weapons.length, 3);
  assert.equal(good.weapons.some((weapon) => weapon.weapon === "9"), false);
  const drone = good.weapons.find((weapon) => weapon.weapon === "DroB");
  assert.equal(drone?.reloads, 2);
  assert.equal(drone?.arc, null);
  assert.equal(good.checks.shieldTotal.status, "pass");
  assert.equal(good.checks.powerSum.status, "pass");
  assert.equal(good.checks.weaponCount.status, "pass");
  assert.equal(good.turn.degPerGameSecond, yawToDegPerGameSecond(good.turn.yawPerTick ?? 0));

  const shield = byName.get("Federation:TEST-SH-01");
  assert.equal(shield?.checks.shieldTotal.status, "fail");
  assert.ok(shield?.checks.shieldTotal.reasons.includes("shieldTotal"));
  assert.equal(shield?.checks.powerSum.status, "pass");
  assert.equal(shield?.checks.weaponCount.status, "pass");

  const power = byName.get("Federation:TEST-PW-01");
  assert.equal(power?.checks.powerSum.status, "fail");
  assert.ok(power?.checks.powerSum.reasons.includes("negative"));
  assert.equal(power?.checks.shieldTotal.status, "pass");
  assert.equal(power?.checks.weaponCount.status, "pass");

  const weapon = byName.get("Federation:TEST-WP-01");
  assert.equal(weapon?.checks.weaponCount.status, "fail");
  assert.ok(weapon?.checks.weaponCount.reasons.includes("countMismatch"));
  assert.ok(weapon?.checks.weaponCount.reasons.includes("unknownWeapon"));
  assert.equal(weapon?.checks.shieldTotal.status, "pass");
  assert.equal(weapon?.checks.powerSum.status, "pass");
  assert.equal(weapon?.weapons.some((item) => item.weapon === "4"), false);

  assert.equal(summary.checks.shieldTotal.fail, 1);
  assert.equal(summary.checks.powerSum.fail, 1);
  assert.equal(summary.checks.weaponCount.fail, 1);
  assert.equal(summary.shieldScaleDivergent, 0);
  assert.equal(summary.harness?.unmatched, 1);
  assert.equal(summary.harness?.fields["power.generation"]?.pass, 1);
  assert.equal(summary.harness?.fields["power.generation"]?.fail, 1);
  assert.equal(summary.harness?.turnUntagged, 2);
  assert.equal(summary.harness?.fields["turn.degPerGameSecond"], undefined);
  assert.equal(summary.harness?.fields["shieldsMeasured.0"]?.fail, 1);
  assert.equal(summary.harness?.fields["shields.0"]?.pass, 1);

  const printed = formatSummary(summary);
  assert.doesNotMatch(printed, /TEST-|Federation|Phot/);
  assert.match(printed, /checks\.shieldTotal pass 3 fail 1 skip 0/);
  assert.match(printed, /harness\.fields\.power\.generation pass 1 fail 1 skip 0/);
  assert.match(printed, /harness\.turnUntagged 2/);
});

test("a bad move cost fails the bind without dropping the shield identity", () => {
  const text = [
    "Race\tHull Type\tClass\tTurn mode\tMove Cost\tShield 1\tShield 2 _ 6\tShield 3 _ 5\tShield 4\tShield Total",
    "Federation\tCA\tTEST-BD-01\tC\tnope\t1\t1\t1\t1\t6",
  ].join("\n");
  const { hulls } = auditText(text);
  assert.equal(hulls.length, 1);
  assert.equal(hulls[0]?.bindError, true);
  assert.equal(hulls[0]?.checks.shieldTotal.status, "pass");
  assert.equal(hulls[0]?.checks.powerSum.status, "fail");
  assert.equal(hulls[0]?.checks.weaponCount.status, "fail");
});

test("Stealth (+ECM) spellings are mapped and an unknown header is not", () => {
  assert.equal(isKnownHeader("Stealth (+ECM)"), true);
  assert.equal(isKnownHeader("Stealth (+ECM)_"), true);
  assert.equal(isKnownHeader("stealth  (+ecm)"), true);
  const text = ["Race\tClass\tStealth (+ECM)_\tMystery Column", "Federation\tTEST-ST-01\t-2\t1"].join("\n");
  const { summary } = auditText(text);
  assert.deepEqual(summary.unmappedNames, ["Mystery Column"]);
  assert.equal(summary.unmappedColumns, 1);
  const stealth = FIELD_COLUMNS.find((column) => column.column === "Stealth (+ECM)");
  assert.equal(stealth?.status, "assumed");
  assert.equal(stealth?.ignored, false);
  assert.equal(stealth?.parserField, "stealth");
});

test("normal and HET turns are separate metrics and untagged rows are skipped", () => {
  const text = [
    "Race\tHull Type\tClass\tTurn mode\tMove Cost\tAcceleration\tShield 1\tShield 2 _ 6\tShield 3 _ 5\tShield 4\tShield Total\tR_L_Warp\tC_Warp\tImpulse\tApr\tBattery",
    "Federation\tCA\tTEST-CA-01\tC\t1\t3\t10\t8\t6\t4\t42\t5\t3\t4\t2\t6",
  ].join("\n");
  const harness = {
    source: "synthetic",
    method: "test",
    heading_convention: "degrees, negative = port",
    runs: [
      {
        label: "test-normal-8",
        spawnKey: "Federation:TEST-CA-01",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 5.7,
        order_delay_s: 0.75,
        expect: { "turn.normal.8.degPerSecond": 5.75, "turn.normal.8.delayS": 0.75 },
        tolerances: { "turn.normal.8.degPerSecond": 0.25, "turn.normal.8.delayS": 0.15 },
      },
      {
        label: "test-normal-slow",
        spawnKey: "Federation:TEST-CA-01",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 5.5,
        order_delay_s: 0.6,
        expect: { "turn.normal.8.degPerSecond": 5.75, "turn.normal.8.delayS": 0.75 },
        tolerances: { "turn.normal.8.degPerSecond": 0.25, "turn.normal.8.delayS": 0.15 },
      },
      {
        label: "test-normal-fast",
        spawnKey: "Federation:TEST-CA-01",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 6,
        order_delay_s: 0.9,
        expect: { "turn.normal.8.degPerSecond": 5.75, "turn.normal.8.delayS": 0.75 },
        tolerances: { "turn.normal.8.degPerSecond": 0.25, "turn.normal.8.delayS": 0.15 },
      },
      {
        label: "test-het-5",
        spawnKey: "Federation:TEST-CA-01",
        turn: "het",
        target_speed: 5,
        total_turn_deg: -94,
        mean_rate_deg_per_game_s_10_90: 51,
        order_delay_s: 5.5,
        expect: { "turn.het.5.deg": -94, "turn.het.5.degPerSecond": 51, "turn.het.5.delayS": 5.5 },
        tolerances: { "turn.het.5.deg": 5, "turn.het.5.degPerSecond": 5, "turn.het.5.delayS": 0.5 },
      },
      {
        label: "test-het-off",
        spawnKey: "Federation:TEST-CA-01",
        turnKind: "het",
        target_speed: 5,
        total_turn_deg: -40,
        mean_rate_deg_per_game_s_10_90: 10,
        order_delay_s: 1,
        expect: { "turn.het.5.deg": -94, "turn.het.5.degPerSecond": 51, "turn.het.5.delayS": 5.5 },
        tolerances: { "turn.het.5.deg": 5, "turn.het.5.degPerSecond": 5, "turn.het.5.delayS": 0.5 },
      },
      {
        label: "test-legacy",
        spawnKey: "Federation:TEST-CA-01",
        target_speed: 5,
        total_turn_deg: -94,
        mean_rate_deg_per_game_s_10_90: 51,
        order_delay_s: 5.5,
      },
      {
        label: "test-normal-nospeed",
        spawnKey: "Federation:TEST-CA-01",
        kind: "normal",
        mean_rate_deg_per_game_s_10_90: 5.7,
      },
    ],
  };
  const { summary } = auditText(text, { harness, tolerance: 0, turnTolerance: 1 });
  assert.equal(summary.checks.shieldTotal.fail, 0);
  assert.equal(summary.harness?.turnUntagged, 1);
  assert.equal(summary.harness?.turnNoSpeed, 1);
  assert.equal(summary.harness?.unmatched, 0);
  assert.equal(summary.harness?.fields["turn.normal.8.degPerSecond"]?.pass, 3);
  assert.equal(summary.harness?.fields["turn.normal.8.degPerSecond"]?.fail, 0);
  assert.equal(summary.harness?.fields["turn.normal.8.delayS"]?.pass, 3);
  assert.equal(summary.harness?.fields["turn.het.5.deg"]?.pass, 1);
  assert.equal(summary.harness?.fields["turn.het.5.deg"]?.fail, 1);
  assert.equal(summary.harness?.fields["turn.het.5.degPerSecond"]?.fail, 1);
  assert.equal(summary.harness?.fields["turn.degPerGameSecond"], undefined);
  assert.equal(summaryFailed(summary), true);
  const printed = formatSummary(summary);
  assert.doesNotMatch(printed, /TEST-|Federation|-94|5\.7/);
  assert.match(printed, /harness\.turnUntagged 1/);
  assert.match(printed, /harness\.fields\.turn\.normal\.8\.degPerSecond pass 3 fail 0 skip 0/);
  assert.match(printed, /harness\.fields\.turn\.het\.5\.degPerSecond pass 1 fail 1 skip 0/);
});

test("a label prefix map correlates a harness run", () => {
  const text = fs.readFileSync(rowsPath, "utf8");
  const { summary } = auditText(text, {
    harness: {
      source: "synthetic",
      method: "test",
      heading_convention: "degrees",
      runs: [{ label: "ca-5", energy_panel: { power: 19 }, mean_rate_deg_per_game_s_10_90: null }],
    },
    hullMap: { ca: "Federation:TEST-CA-01" },
  });
  assert.equal(summary.harness?.unmatched, 0);
  assert.equal(summary.harness?.fields["power.generation"]?.pass, 1);
  assert.equal(summary.harness?.fields["turn.degPerGameSecond"], undefined);
});

test("cli prints counts only and writes hull files under out", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ship-audit-"));
  const cli = path.join(root, "tools/ship-audit/cli.ts");
  const ran = spawnSync(
    process.execPath,
    ["--experimental-strip-types", cli, "--shiplist", rowsPath, "--harness", harnessPath, "--out", out],
    { encoding: "utf8" },
  );
  assert.equal(ran.status, 1, ran.stderr);
  assert.doesNotMatch(ran.stdout, /TEST-|Federation|Phot|42|99/);
  assert.doesNotMatch(ran.stdout, /rows\.txt|results-test/);
  assert.match(ran.stdout, /^ship-audit\n/);
  const hulls = JSON.parse(fs.readFileSync(path.join(out, "hulls.json"), "utf8")) as { hulls: { spawnKey: string }[] };
  assert.equal(hulls.hulls.some((hull) => hull.spawnKey === "Federation:TEST-SH-01"), true);
  assert.match(fs.readFileSync(path.join(out, "hulls.csv"), "utf8"), /TEST-SH-01/);
  const summary = JSON.parse(fs.readFileSync(path.join(out, "summary.json"), "utf8")) as { rows: number };
  assert.equal(summary.rows, 4);
  fs.rmSync(out, { recursive: true, force: true });
});

test("install lookup prefers Assets/Specs and reports differing copies as a count", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ship-install-"));
  const specs = path.join(dir, "Assets", "Specs");
  const meta = path.join(dir, "MetaAssets");
  fs.mkdirSync(specs, { recursive: true });
  fs.mkdirSync(meta, { recursive: true });
  const body = fs.readFileSync(rowsPath);
  fs.writeFileSync(path.join(specs, "shiplist.txt"), body);
  fs.writeFileSync(path.join(meta, "shiplist.txt"), Buffer.from("other\n"));
  const loaded = await readInstallShiplist(dir);
  assert.equal(loaded.copies.differ, 1);
  assert.equal(loaded.copies.assetsRows, 4);
  assert.equal(loaded.copies.metaRows, 0);
  assert.match(loaded.copies.note, /assets\/specs and metaassets shiplist.txt differ/);
  assert.match(Buffer.from(loaded.bytes).toString("utf8"), /TEST-CA-01/);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ship-audit-out-"));
  const cli = path.join(root, "tools/ship-audit/cli.ts");
  const ran = spawnSync(
    process.execPath,
    ["--experimental-strip-types", cli, "--install", dir, "--out", out],
    { encoding: "utf8" },
  );
  assert.equal(ran.status, 1, ran.stderr);
  assert.doesNotMatch(ran.stdout, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(ran.stdout, /copiesDiffer 1/);
  assert.match(ran.stdout, /copies\.note assets\/specs and metaassets shiplist.txt differ/);
  assert.match(ran.stdout, /copies\.assetsRows 4/);
  assert.match(ran.stdout, /copies\.metaRows 0/);
  assert.match(ran.stdout, /copies\.onlyInOne /);
  assert.doesNotMatch(ran.stdout, /TEST-|other/);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(out, { recursive: true, force: true });
});

test("table expect scores F-CA and K-D7 normal turns when the run omits expect", () => {
  const text = [
    "Race\tHull Type\tClass\tTurn mode\tMove Cost\tAcceleration\tShield 1\tShield 2 _ 6\tShield 3 _ 5\tShield 4\tShield Total\tR_L_Warp\tC_Warp\tImpulse\tApr\tBattery",
    "Federation\tCA\tF-CA\tC\t1\t3\t10\t8\t6\t4\t42\t5\t3\t4\t2\t6",
    "Klingon\tCA\tK-D7\tC\t1\t3\t10\t8\t6\t4\t42\t5\t3\t4\t2\t6",
    "Federation\tCA\tTEST-CA-01\tC\t1\t3\t10\t8\t6\t4\t42\t5\t3\t4\t2\t6",
  ].join("\n");
  const harness = {
    source: "synthetic",
    method: "test",
    heading_convention: "degrees, negative = port",
    runs: [
      {
        label: "fca-normal-8",
        spawnKey: "Federation:F-CA",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 6.9,
        order_delay_s: 1.45,
      },
      {
        label: "fca-normal-8-edge",
        spawnKey: "Federation:F-CA",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 7.2,
        order_delay_s: 1.3,
      },
      {
        label: "fca-normal-8-miss",
        spawnKey: "Federation:F-CA",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 7.3,
        order_delay_s: 1.2,
      },
      {
        label: "fca-normal-29-5",
        spawnKey: "Federation:F-CA",
        turn: "normal",
        target_speed: 29.5,
        mean_rate_deg_per_game_s_10_90: 8.0,
        order_delay_s: 1.45,
      },
      {
        label: "kd7-normal-7",
        spawnKey: "Klingon:K-D7",
        turn: "normal",
        target_speed: 7,
        mean_rate_deg_per_game_s_10_90: 8.6,
        order_delay_s: 1.45,
      },
      {
        label: "test-no-table",
        spawnKey: "Federation:TEST-CA-01",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 6.9,
        order_delay_s: 0.75,
      },
      {
        label: "fca-override",
        spawnKey: "Federation:F-CA",
        turn: "normal",
        target_speed: 8,
        mean_rate_deg_per_game_s_10_90: 5.75,
        order_delay_s: 0.75,
        expect: { "turn.normal.8.degPerSecond": 5.75, "turn.normal.8.delayS": 0.75 },
        tolerances: { "turn.normal.8.degPerSecond": 0.25, "turn.normal.8.delayS": 0.15 },
      },
    ],
  };
  const { summary } = auditText(text, { harness, tolerance: 0, turnTolerance: 1 });
  assert.equal(summary.harness?.unmatched, 0);
  assert.equal(summary.harness?.fields["turn.normal.8.degPerSecond"]?.pass, 3);
  assert.equal(summary.harness?.fields["turn.normal.8.degPerSecond"]?.fail, 1);
  assert.equal(summary.harness?.fields["turn.normal.8.degPerSecond"]?.skip, 1);
  assert.equal(summary.harness?.fields["turn.normal.8.delayS"]?.pass, 3);
  assert.equal(summary.harness?.fields["turn.normal.8.delayS"]?.fail, 1);
  assert.equal(summary.harness?.fields["turn.normal.8.delayS"]?.skip, 1);
  assert.equal(summary.harness?.fields["turn.normal.29.5.degPerSecond"]?.pass, 1);
  assert.equal(summary.harness?.fields["turn.normal.29.5.delayS"]?.pass, 1);
  assert.equal(summary.harness?.fields["turn.normal.7.degPerSecond"]?.pass, 1);
  assert.equal(summary.harness?.fields["turn.normal.7.delayS"]?.skip, 1);
  assert.equal(summaryFailed(summary), true);
  const printed = formatSummary(summary);
  assert.doesNotMatch(printed, /F-CA|K-D7|TEST-|6\.9|1\.45/);
});
