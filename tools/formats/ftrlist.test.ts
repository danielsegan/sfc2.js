import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseFtrlist, type Diagnostic } from "./index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = "Assets/Specs/ftrlist.txt";

function readFixture(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function codes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

test("minimal ftrlist fixture parses invented rows", () => {
  const text = readFixture("tools/fixtures/formats/ftrlist/minimal.txt");
  const parsed = parseFtrlist(text, { file: "MetaAssets\\ftrlist.txt" });
  assert.deepEqual(codes(parsed.diagnostics), []);
  assert.equal(parsed.data.rows.length, 2);
  assert.equal(parsed.data.rows[0].fields.Type, "TEST-FTR-01");
  assert.equal(parsed.data.rows[0].fields.Speed, 17);
  assert.equal(parsed.data.rows[0].fields["Year First"], 3);
  assert.equal(parsed.data.rows[0].fields["Year Last"], 999);
  assert.equal(parsed.data.rows[0].fields.Damage, 9);
  assert.equal(parsed.data.rows[0].fields["Ship Class"], "TEST-FTR-01");
  assert.equal(parsed.data.rows[0].fields.Geometry, "assets/models/test_ftr01/test_ftr01.mod");
  assert.deepEqual(parsed.data.rows[0].weapons, []);
  assert.equal(parsed.data.rows[1].fields.Type, "TEST-PF-02");

  const missing = parseFtrlist(text, { shipClassNames: ["OTHER"] });
  assert.deepEqual(codes(missing.diagnostics), ["missingShipRef", "missingShipRef"]);
  assert.equal(missing.diagnostics[0].source, "ftrlist");
  assert.equal(missing.diagnostics[0].severity, "warning");
  assert.deepEqual(missing.diagnostics[0].details, {
    shipClassRef: "TEST-FTR-01",
    typeName: "TEST-FTR-01",
  });
  assert.equal(missing.diagnostics[0].location?.field, "Ship Class");

  const linked = parseFtrlist(text, { shipClassNames: ["test-ftr-01", "TEST-PF-02"] });
  assert.deepEqual(codes(linked.diagnostics), []);
});

test("documented ftrlist columns, fighter drones, and loader codes", () => {
  const parsed = parseFtrlist(readFixture("tools/fixtures/formats/ftrlist/edges.txt"), {
    file: "Assets\\Specs\\ftrlist.txt",
  });
  assert.deepEqual(codes(parsed.diagnostics), [
    "multipleHeaderRows",
    "badNumber",
    "badNumber",
    "unknownWeapon",
    "unknownWeapon",
    "unknownArc",
    "unknownArc",
    "yearOrder",
    "unknownRace",
    "raggedRow",
    "duplicateFighterType",
  ]);
  assert.equal(parsed.data.columns.length, 36);
  assert.equal(parsed.data.columns[4], "Weapon1");
  assert.equal(parsed.data.columns[24], "ADD_6");
  assert.equal(parsed.data.columns[35], "Name");
  assert.equal(parsed.diagnostics[0].location?.line, 2);
  assert.equal(parsed.diagnostics[0].location?.file, FILE);
  assert.equal(parsed.diagnostics[0].details?.count, 2);

  const good = parsed.data.rows[0];
  assert.equal(good.line, 3);
  assert.equal(good.fields.Speed, 12);
  assert.equal(good.fields["Ground Attack Bonus"], 1.5);
  assert.equal(good.fields.ADD_6, 0);
  assert.equal(good.fields.Name, "Test Fighter 01");
  assert.equal(good.fields["First Year Avail"], 1);
  assert.equal(good.fields["Last Year Avail"], 20);
  assert.equal(good.fields.Num, undefined);
  assert.equal(good.fields.Weapon1, undefined);
  assert.equal(good.weapons.length, 5);
  assert.deepEqual(good.weapons[0], {
    slotIndex: 0,
    count: 1,
    weapon: "Ph3",
    arc: "FH",
    load: 2,
    reload: null,
  });
  assert.equal(good.weapons[1].weapon, "DroVI");
  assert.equal(good.weapons[1].arc, "ALL");
  assert.equal(good.weapons[1].reload, null);
  assert.equal(good.weapons[1].load, 2);
  assert.equal(good.weapons[2].weapon, "PhoF");
  assert.equal(good.weapons[2].arc, "FX");
  assert.equal(good.weapons[3].weapon, null);
  assert.equal(good.weapons[3].count, 0);

  const bad = parsed.data.rows[1];
  assert.equal(bad.weapons[0].weapon, "PLAF");
  assert.equal(bad.weapons[0].arc, "FA");
  assert.equal(bad.weapons[1].weapon, "DroI");
  assert.equal(bad.weapons[1].arc, "ALL");
  assert.equal(bad.weapons[1].reload, null);
  assert.equal(bad.weapons[2].weapon, "DroA");
  assert.equal(bad.weapons[2].arc, null);
  assert.equal(bad.weapons[2].reload, 2);
  assert.equal(bad.weapons[2].load, 3);
  assert.equal(bad.weapons[4].weapon, "Ph2");
  assert.equal(bad.weapons[4].arc, "4");
  assert.equal(bad.weapons[4].load, 0);
  assert.equal(bad.fields.Damage, 0);

  const weaponDiag = parsed.diagnostics.find((diagnostic) => diagnostic.details?.code === "PLAF");
  assert.equal(weaponDiag?.source, "loader");
  assert.deepEqual(weaponDiag?.details, {
    spawnKey: "Hydran:TEST-FTR-01",
    slotIndex: 0,
    code: "PLAF",
  });
  assert.equal(weaponDiag?.location?.field, "Weapon1");
  assert.equal(weaponDiag?.location?.column, 5);

  const zz = parsed.diagnostics.find((diagnostic) => diagnostic.details?.code === "ZZ");
  assert.equal(zz?.code, "unknownArc");
  assert.equal(zz?.details?.slotIndex, 3);
  assert.equal(zz?.location?.column, 18);
  assert.deepEqual(
    parsed.diagnostics.find((diagnostic) => diagnostic.code === "yearOrder")?.details,
    { first: 8, last: 1 },
  );
  assert.equal(parsed.diagnostics.find((diagnostic) => diagnostic.code === "badNumber")?.details?.raw, "no");
  assert.equal(parsed.diagnostics.find((diagnostic) => diagnostic.code === "unknownRace")?.details?.value, "Tholian");
  assert.equal(parsed.data.rows[2].weapons[1].weapon, "PLaS");
  assert.equal(parsed.data.rows[2].weapons[1].arc, "FA");
  assert.equal(parsed.data.rows[2].weapons[0].arc, "ALL");
  assert.deepEqual(
    parsed.diagnostics.find((diagnostic) => diagnostic.code === "duplicateFighterType")?.details,
    { typeName: "TEST-FTR-01", rows: [3, 4] },
  );
  assert.equal(parsed.data.rows[3].fields.Type, "TEST-FTR-04");
  assert.ok(parsed.data.rows[3].weapons.every((weapon) => weapon.weapon == null));

  const quiet = parseFtrlist(readFixture("tools/fixtures/formats/ftrlist/edges.txt"), {
    checkVocabulary: false,
  });
  assert.equal(quiet.diagnostics.some((diagnostic) => diagnostic.code === "unknownWeapon"), false);
  assert.equal(quiet.diagnostics.some((diagnostic) => diagnostic.code === "unknownArc"), false);
  assert.equal(quiet.data.rows[1].weapons[2].reload, 2);
  assert.ok(quiet.diagnostics.some((diagnostic) => diagnostic.code === "badNumber"));
  assert.ok(quiet.diagnostics.some((diagnostic) => diagnostic.code === "duplicateFighterType"));
});

test("ftrlist without a header keeps raw cells and does not guess columns", () => {
  const parsed = parseFtrlist("1\t2\t3\t4\t5\t6\t7\t8\n", { file: "Assets\\Specs\\ftrlist.txt" });
  assert.deepEqual(codes(parsed.diagnostics), ["noHeader"]);
  assert.equal(parsed.diagnostics[0].severity, "error");
  assert.equal(parsed.diagnostics[0].source, "ftrlist");
  assert.equal(parsed.diagnostics[0].location, undefined);
  assert.deepEqual(parsed.data.rows[0].fields, {});
  assert.deepEqual(parsed.data.rows[0].weapons, []);
  assert.equal(parsed.data.rows[0].extra.col0, "1");
  assert.equal(parsed.data.rows[0].extra.col7, "8");
});

test("a non-Race header is still a header, and bad input does not throw", () => {
  const parsed = parseFtrlist("Empire\tType\tSpeed\nHydran\tTEST-FTR-09\t6\n");
  assert.deepEqual(codes(parsed.diagnostics), []);
  assert.deepEqual(parsed.data.columns, ["Empire", "Type", "Speed"]);
  assert.equal(parsed.data.rows[0].fields.Empire, "Hydran");
  assert.equal(parsed.data.rows[0].fields.Type, "TEST-FTR-09");
  assert.equal(parsed.data.rows[0].fields.Speed, 6);
  assert.equal(parsed.data.rows[0].fields.Race, undefined);

  const empty = parseFtrlist("");
  assert.deepEqual(codes(empty.diagnostics), ["emptyFile"]);
  assert.equal(empty.diagnostics[0].severity, "error");
  assert.doesNotThrow(() => parseFtrlist("\0\0\t\t"));
  assert.throws(() => parseFtrlist(null as unknown as string), TypeError);
});
