import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PLA_CODES,
  RELOAD_COUNTED,
  RELOAD_TOKENS,
  WEAPON_DEFS,
  compareSpecCopies,
  parseShiplist,
  type Diagnostic,
  type ShiplistRow,
} from "./index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = "Assets/Specs/shiplist.txt";

function readFixture(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function codes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

function byCode(diagnostics: Diagnostic[], code: string): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === code);
}

function assertInstallPaths(diagnostics: Diagnostic[], file: string): void {
  for (const diagnostic of diagnostics) {
    if (diagnostic.code === "emptyFile" || diagnostic.code === "noHeader") {
      assert.equal(diagnostic.location, undefined);
      continue;
    }
    assert.ok(diagnostic.location, diagnostic.code);
    assert.equal(diagnostic.location.file, file);
    assert.equal(diagnostic.location.file.includes("\\"), false);
  }
}

test("ten Pla spellings are separate codes and reload racks are exactly the seven", () => {
  const pla = Object.keys(WEAPON_DEFS).filter((code) => /pla/i.test(code)).sort();
  assert.deepEqual(pla, [...PLA_CODES].sort());
  for (const code of PLA_CODES) {
    assert.equal(WEAPON_DEFS[code]?.internal, "plasma");
  }
  assert.equal(WEAPON_DEFS.PlaF?.weaponId, WEAPON_DEFS.PLaF?.weaponId);
  assert.notEqual(WEAPON_DEFS.PlaF, undefined);
  assert.ok(WEAPON_DEFS.PlaF !== WEAPON_DEFS.PLaF);
  for (const code of RELOAD_COUNTED) {
    assert.equal(WEAPON_DEFS[code]?.reloadCounted, true, code);
  }
  assert.notEqual(WEAPON_DEFS.DroI?.reloadCounted, true);
  assert.notEqual(WEAPON_DEFS.DroVI?.reloadCounted, true);
  assert.deepEqual([...RELOAD_TOKENS], ["1", "2", "3"]);
});

test("minimal shiplist fixture parses invented rows without diagnostics", () => {
  const parsed = parseShiplist(readFixture("tools/fixtures/formats/shiplist/minimal.txt"), {
    file: "Assets\\Specs\\shiplist.txt",
  });
  assert.deepEqual(codes(parsed.diagnostics), []);
  assert.deepEqual(
    parsed.data.rows.map((row) => row.spawnKey),
    ["Federation:TEST-CA-01", "Klingon:TEST-FF-02", "Neutral:TEST-BS-03"],
  );
  assert.deepEqual(
    parsed.data.rows.map((row) => row.line),
    [2, 3, 4],
  );
  const first = parsed.data.rows[0];
  assert.equal(first.fields["Shield 1"], 17);
  assert.equal(first.fields["Move Cost"], 0.75);
  assert.equal(first.fields.Cloak, 0);
  assert.equal(first.fields.BPV, 101);
  assert.equal(first.fields.Class, "TEST-CA-01");
  assert.equal(first.fields["Hull Type"], "CA");
  assert.equal(first.fields["Turn Mode"], "C");
  assert.equal(first.fields.Geometry, "assets/models/test_ca01/test_ca01.mod");
  assert.equal(first.fields.UI, "TCA");
  assert.equal(first.raw[7], "");
  assert.equal(first.raw.length, 10);
  assert.equal(parsed.data.rows[1].raw.length, 11);
  assert.equal(parsed.data.rows[1].fields["Move Cost"], 0.4);
  assert.equal(first.hardpoints.length, 25);
  assert.ok(first.hardpoints.every((slot) => slot.weapon == null && slot.reloads == null && slot.arc == null));
  assert.deepEqual(parsed.data.columns, [
    "Race",
    "Hull Type",
    "Class",
    "BPV",
    "Turn Mode",
    "Move Cost",
    "Shield 1",
    "Cloak",
    "Geometry",
    "UI",
  ]);
});

test("edges fixture reports structural diagnostics and keeps the row", () => {
  const parsed = parseShiplist(readFixture("tools/fixtures/formats/shiplist/edges.txt"), {
    file: "Assets\\Specs\\shiplist.txt",
  });
  assert.deepEqual(codes(parsed.diagnostics), [
    "multipleHeaderRows",
    "badNumber",
    "unknownTurnMode",
    "yearOrder",
    "shieldTotalMismatch",
    "crewTotalMismatch",
    "missingGeometry",
    "unknownRace",
    "unknownHullType",
    "raggedRow",
    "raggedRow",
    "missingRefitBase",
    "duplicateClassKey",
    "duplicateClassName",
  ]);
  assertInstallPaths(parsed.diagnostics, FILE);
  assert.equal(parsed.data.headerRows.length, 2);
  assert.equal(parsed.data.rows.length, 7);
  assert.equal(parsed.data.rows[0].fields.Notes, "note-a");
  assert.equal(parsed.data.rows[0].fields["Move Cost"], 0.5);
  assert.equal(parsed.data.rows[0].raw.at(-1), "");
  assert.deepEqual(parsed.data.rows[0].extra, {});

  const bad = byCode(parsed.diagnostics, "badNumber")[0];
  assert.equal(bad.location?.line, 4);
  assert.equal(bad.location?.column, 4);
  assert.equal(bad.location?.field, "BPV");
  assert.deepEqual(bad.details, { raw: "nope" });
  assert.equal(parsed.data.rows[1].fields.BPV, 0);

  assert.equal(byCode(parsed.diagnostics, "unknownTurnMode")[0].details?.value, "Z");
  assert.deepEqual(byCode(parsed.diagnostics, "yearOrder")[0].details, { first: 9, last: 1 });
  assert.deepEqual(byCode(parsed.diagnostics, "shieldTotalMismatch")[0].details, { expected: 42, actual: 1 });
  assert.equal(byCode(parsed.diagnostics, "shieldTotalMismatch")[0].severity, "info");
  assert.deepEqual(byCode(parsed.diagnostics, "crewTotalMismatch")[0].details, { expected: 15, actual: 99 });
  assert.equal(byCode(parsed.diagnostics, "missingGeometry")[0].details?.className, "TEST-EDGE-02");
  assert.equal(byCode(parsed.diagnostics, "unknownRace")[0].details?.value, "Andorian");
  assert.equal(byCode(parsed.diagnostics, "unknownHullType")[0].details?.value, "ZZZ");

  const ragged = byCode(parsed.diagnostics, "raggedRow");
  assert.deepEqual(ragged[0].details, { expected: 20, actual: 4 });
  assert.equal(ragged[0].location?.line, 7);
  assert.deepEqual(ragged[1].details, { expected: 20, actual: 21 });
  assert.equal(parsed.data.rows[5].extra.col20, "EXTRA-CELL");

  assert.deepEqual(byCode(parsed.diagnostics, "missingRefitBase")[0].details, {
    refitBaseClass: "TEST-MISSING",
  });
  assert.deepEqual(byCode(parsed.diagnostics, "duplicateClassKey")[0].details, {
    race: "Federation",
    className: "TEST-EDGE-01",
    rows: [3, 6],
  });
  assert.equal(byCode(parsed.diagnostics, "duplicateClassKey")[0].severity, "error");
  assert.equal(byCode(parsed.diagnostics, "duplicateClassKey")[0].source, "shiplist");
  assert.deepEqual(byCode(parsed.diagnostics, "duplicateClassName")[0].details, {
    className: "TEST-EDGE-01",
    races: ["Federation", "Andorian"],
    rows: [3, 5, 6],
  });
  assert.equal(byCode(parsed.diagnostics, "crewTotalMismatch").length, 1);
  assert.equal(parsed.data.rows[6].spawnKey, "Neutral:TEST-EDGE-09");
});

test("weapon fixture keeps each Pla spelling and interprets reload arcs", () => {
  const parsed = parseShiplist(readFixture("tools/fixtures/formats/shiplist/weapons.txt"), {
    file: `./${FILE}`,
  });
  const [first, second, third] = parsed.data.rows;
  assert.equal(first.spawnKey, "Federation:TEST-WPN-01");
  const spellings = first.hardpoints.slice(0, 10).map((slot) => slot.weapon);
  assert.deepEqual(spellings, [...PLA_CODES]);
  assert.equal(first.hardpoints[0].arc, "FLLX");
  assert.equal(first.hardpoints[0].count, 4);
  assert.equal(first.hardpoints[0].reloads, null);
  for (const slot of first.hardpoints.slice(10, 17)) {
    assert.equal(slot.arc, null, slot.weapon ?? "");
    assert.ok(slot.reloads === 1 || slot.reloads === 2 || slot.reloads === 3);
  }
  assert.equal(first.hardpoints[10].weapon, "DroA");
  assert.equal(first.hardpoints[10].reloads, 2);
  assert.equal(first.hardpoints[17].weapon, "Phot");
  assert.equal(first.hardpoints[17].arc, "1");
  assert.equal(first.hardpoints[17].reloads, null);
  assert.equal(first.hardpoints[18].arc, "FA");
  assert.equal(first.hardpoints[18].reloads, null);
  assert.equal(first.hardpoints[21].weapon, "PLAF");
  assert.equal(first.hardpoints[21].arc, "FA");
  assert.equal(first.fields.Num, undefined);
  assert.equal(first.fields.Arc, undefined);

  assert.equal(second.hardpoints[1].weapon, "DroI");
  assert.equal(second.hardpoints[1].arc, "ALL");
  assert.equal(second.hardpoints[1].reloads, null);
  assert.equal(second.hardpoints[2].weapon, "DroVI");
  assert.equal(second.hardpoints[2].arc, "ALL");
  assert.equal(second.hardpoints[2].reloads, null);
  assert.equal(second.hardpoints[4].arc, "2");
  assert.equal(second.hardpoints[4].reloads, null);
  assert.equal(second.hardpoints[5].weapon, "TEST-PH");
  assert.equal(second.hardpoints[5].arc, "TEST-FA");

  assert.equal(third.hardpoints[0].count, 0);
  assert.equal(third.hardpoints[1].arc, "1.0");
  assert.equal(third.hardpoints[1].reloads, null);
  assert.equal(third.hardpoints[2].arc, "01");

  const rowDiag = (row: ShiplistRow): Diagnostic[] =>
    parsed.diagnostics.filter((diagnostic) => diagnostic.location?.line === row.line);
  assert.deepEqual(codes(rowDiag(first)), [
    "unknownArc",
    "unknownArc",
    "unknownArc",
    "unknownArc",
    "unknownWeapon",
    "hardpointCountRange",
    "hardpointCountRange",
    "hardpointCountRange",
  ]);
  const plaWeaponDiags = rowDiag(first).filter((diagnostic) => {
    const code = diagnostic.details?.code;
    return diagnostic.code === "unknownWeapon" && typeof code === "string" && (PLA_CODES as readonly string[]).includes(code);
  });
  assert.equal(plaWeaponDiags.length, 0);
  const unknownWeapon = rowDiag(first).find((diagnostic) => diagnostic.code === "unknownWeapon");
  assert.equal(unknownWeapon?.source, "loader");
  assert.equal(unknownWeapon?.severity, "warning");
  assert.deepEqual(unknownWeapon?.details, {
    spawnKey: "Federation:TEST-WPN-01",
    slotIndex: 21,
    code: "PLAF",
  });
  assert.equal(unknownWeapon?.location?.field, "Weapon 22");
  const emptyArc = rowDiag(first).find(
    (diagnostic) => diagnostic.code === "unknownArc" && diagnostic.details?.code === "",
  );
  assert.equal(emptyArc?.details?.slotIndex, 19);
  assert.equal(emptyArc?.location?.field, "Arc");

  assert.deepEqual(codes(rowDiag(second)), ["unknownArc", "unknownWeapon", "unknownArc"]);
  assert.equal(rowDiag(second)[0].details?.code, "SFBL");
  assert.equal(rowDiag(second)[1].details?.code, "plaF");
  assert.equal(rowDiag(second)[2].details?.code, "2");

  assert.deepEqual(codes(rowDiag(third)), ["badNumber", "hardpointCountRange", "unknownArc", "unknownArc"]);
  assert.equal(rowDiag(third)[2].details?.code, "1.0");
  assert.equal(rowDiag(third)[3].details?.code, "01");
  assertInstallPaths(parsed.diagnostics, FILE);

  const quiet = parseShiplist(readFixture("tools/fixtures/formats/shiplist/weapons.txt"), {
    checkVocabulary: false,
  });
  assert.equal(quiet.diagnostics.some((diagnostic) => diagnostic.source === "loader"), false);
  assert.equal(quiet.data.rows[0].hardpoints[10].reloads, 2);
  assert.equal(quiet.data.rows[0].hardpoints[10].arc, null);
  assert.ok(quiet.diagnostics.some((diagnostic) => diagnostic.code === "hardpointCountRange"));
});

test("no header falls back to proposed column indexes", () => {
  const cells = Array<string>(28).fill("0");
  cells[0] = "Federation";
  cells[1] = "CA";
  cells[2] = "TEST-IX-01";
  cells[3] = "15";
  cells[8] = "C";
  cells[9] = "fast";
  cells[25] = "2";
  cells[26] = "DroA";
  cells[27] = "3";
  const parsed = parseShiplist(cells.join("\t"), { file: FILE });
  assert.deepEqual(codes(parsed.diagnostics), ["noHeader", "badNumber"]);
  assert.equal(parsed.diagnostics[0].severity, "warning");
  assert.equal(parsed.diagnostics[0].location, undefined);
  assert.equal(parsed.data.columns.length, 0);
  const row = parsed.data.rows[0];
  assert.equal(row.spawnKey, "Federation:TEST-IX-01");
  assert.equal(row.fields.col0, "Federation");
  assert.equal(row.fields.col3, 15);
  assert.equal(row.fields.col9, 0);
  assert.equal(row.fields.col26, undefined);
  assert.equal(row.hardpoints[0].count, 2);
  assert.equal(row.hardpoints[0].weapon, "DroA");
  assert.equal(row.hardpoints[0].arc, null);
  assert.equal(row.hardpoints[0].reloads, 3);
  assert.equal(parsed.diagnostics[1].location?.field, "col9");
  assert.equal(parsed.diagnostics[1].location?.column, 10);
  assert.equal(parsed.diagnostics[1].location?.file, FILE);
});

test("same-race duplicate is duplicateClassKey only", () => {
  const parsed = parseShiplist("Race\tClass\nFederation\tTEST-DUP-01\nfederation\tTEST-DUP-01\n");
  assert.deepEqual(codes(parsed.diagnostics), ["duplicateClassKey"]);
  assert.deepEqual(parsed.diagnostics[0].details, {
    race: "Federation",
    className: "TEST-DUP-01",
    rows: [2, 3],
  });
});

test("empty numeric cells become 0 and negative stealth is kept", () => {
  const parsed = parseShiplist(
    "Race\tClass\tStealth\tMove Cost\tAcceleration\tCloak\nFederation\tTEST-ST-01\t-2\t0.75\t\t\n",
  );
  assert.deepEqual(codes(parsed.diagnostics), []);
  const row = parsed.data.rows[0];
  assert.equal(row.fields.Stealth, -2);
  assert.equal(row.fields["Move Cost"], 0.75);
  assert.equal(row.fields.Acceleration, 0);
  assert.equal(row.fields.Cloak, 0);
  assert.equal(row.raw[4], "");
});

test("bytes decode as windows-1252 and accept a BOM or CR line ends", () => {
  const encoded = new Uint8Array([
    ...new TextEncoder().encode("Race\tClass\nFederation\tTEST-"),
    0xe9,
    ...new TextEncoder().encode("\n"),
  ]);
  const decoded = parseShiplist(encoded);
  assert.equal(decoded.data.rows[0].spawnKey, "Federation:TEST-é");
  assert.equal(decoded.data.rows[0].fields.Class, "TEST-é");

  const bombed = new Uint8Array([
    0xef,
    0xbb,
    0xbf,
    ...new TextEncoder().encode("Race\tClass\r\nFederation\tTEST-BOM-01\r\n"),
  ]);
  assert.equal(parseShiplist(bombed.buffer).data.rows[0].spawnKey, "Federation:TEST-BOM-01");
  assert.equal(
    parseShiplist("Race\tClass\rFederation\tTEST-CR-01\r").data.rows[0].spawnKey,
    "Federation:TEST-CR-01",
  );
});

test("bad text does not throw and a wrong argument type does", () => {
  const empty = parseShiplist(" \t \n\n", { file: FILE });
  assert.deepEqual(codes(empty.diagnostics), ["emptyFile"]);
  assert.equal(empty.diagnostics[0].source, "shiplist");
  assert.equal(empty.diagnostics[0].severity, "error");
  assert.equal(empty.data.rows.length, 0);

  const junk = parseShiplist("@@@@");
  assert.equal(junk.data.rows.length, 0);
  assert.deepEqual(codes(junk.diagnostics), ["noHeader"]);

  const tabs = parseShiplist("\t\t\t");
  assert.deepEqual(codes(tabs.diagnostics), ["emptyFile"]);
  assert.equal(tabs.data.rows.length, 0);

  const odd = parseShiplist("???\tnot-a-number\t%%%");
  assert.deepEqual(odd.data.columns, ["???", "not-a-number", "%%%"]);
  assert.equal(odd.data.rows.length, 0);

  assert.doesNotThrow(() => parseShiplist(new Uint8Array([0xff, 0xfe, 0x00, 0x09, 0x41])));
  assert.throws(() => parseShiplist(1 as unknown as string), TypeError);
});

test("spec copy comparison ignores line endings and a BOM", () => {
  assert.equal(compareSpecCopies("shiplist", "A\tB\r\n", "A\tB\n"), null);
  assert.equal(compareSpecCopies("shiplist", "\uFEFFA\n", "A\n"), null);
  const differ = compareSpecCopies("shiplist", "one", "two", "Assets\\Specs\\shiplist.txt");
  assert.ok(differ);
  assert.equal(differ.code, "specsMetaassetsDiffer");
  assert.equal(differ.source, "shiplist");
  assert.equal(differ.severity, "warning");
  assert.deepEqual(differ.location, { file: FILE });
});
