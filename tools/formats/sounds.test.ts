import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseSounds, type Diagnostic } from "./index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = "assets/sounds/sounds.txt";

function readFixture(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function codes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

test("minimal sounds fixture parses invented rows without diagnostics", () => {
  const parsed = parseSounds(readFixture("tools/fixtures/formats/sounds/minimal.txt"), {
    file: "assets\\sounds\\sounds.txt",
  });
  assert.deepEqual(codes(parsed.diagnostics), []);
  assert.deepEqual(parsed.data.header, ["Primary Identifier", "Filename", "Description"]);
  assert.equal(parsed.data.classes.length, 2);
  assert.equal(parsed.data.classes[0]?.name, "Test Effects");
  assert.equal(parsed.data.classes[0]?.id, 1);
  assert.equal(parsed.data.classes[0]?.maxAtOnce, 8);
  assert.equal(parsed.data.classes[0]?.preempt, "any");
  assert.equal(parsed.data.classes[1]?.preempt, "never");
  assert.equal(parsed.data.classes[1]?.minIntervalSeconds, 1);
  assert.equal(parsed.data.entries.length, 7);
  const phaser = parsed.data.entries[0];
  assert.equal(phaser?.identifier, "testPhaserFire");
  assert.equal(phaser?.filename, "sounds/test-phaser.wav");
  assert.equal(phaser?.description, "invented phaser fire");
  assert.equal(phaser?.compress, 1);
  assert.equal(phaser?.randomIndex, 40);
  assert.equal(phaser?.index, 11);
  assert.equal(phaser?.priority, 90);
  assert.deepEqual(phaser?.classes, ["Test Effects"]);
  assert.equal(phaser?.minFreq, 21000);
  assert.equal(phaser?.maxVolume, 70);
  assert.equal(phaser?.done, true);
  assert.equal(phaser?.loop, false);
  const photon = parsed.data.entries.find((entry) => entry.identifier === "testPhotonFire");
  assert.equal(photon?.compress, null);
  assert.equal(photon?.minVolume, 70);
  for (const diagnostic of parsed.diagnostics) {
    assert.equal(diagnostic.source, "sounds");
    assert.equal(diagnostic.location?.file, FILE);
  }
});

test("edges fixture reports structural problems and drops unsafe filenames", () => {
  const parsed = parseSounds(readFixture("tools/fixtures/formats/sounds/edges.txt"), { file: FILE });
  assert.deepEqual(codes(parsed.diagnostics), [
    "badNumber",
    "unknownPreempt",
    "missingFilename",
    "pathRejected",
    "duplicateClassId",
    "duplicateIndex",
  ]);
  assert.equal(parsed.diagnostics[0]?.details?.value, "nope");
  assert.equal(parsed.diagnostics[3]?.details?.reason, "filename");
  assert.equal(JSON.stringify(parsed.diagnostics).includes("C:"), false);
  assert.equal(JSON.stringify(parsed.diagnostics).includes("outside"), false);
  const abs = parsed.data.entries.find((entry) => entry.identifier === "testAbs");
  assert.equal(abs?.filename, null);
  const missing = parsed.data.entries.find((entry) => entry.identifier === "testMissing");
  assert.equal(missing?.filename, null);
  const thresholds = parsed.data.entries.filter((entry) => entry.index === 8);
  assert.deepEqual(thresholds.map((entry) => entry.loadThresholds), [[1], [2]]);
  const pcm = parsed.data.entries.find((entry) => entry.fileType === "pcm22k16m");
  assert.equal(pcm?.filename, "sounds/test-tone.pcm");
  assert.equal(parsed.data.entries.some((entry) => (entry.description ?? "").includes("comment")), false);
  for (const diagnostic of parsed.diagnostics) {
    if (diagnostic.code === "emptyFile") continue;
    assert.equal(diagnostic.location?.file, FILE);
    assert.equal(diagnostic.source, "sounds");
  }
});

test("empty and whitespace input is emptyFile without a location", () => {
  for (const input of ["", "   \n\t", new Uint8Array()]) {
    const parsed = parseSounds(input, { file: FILE });
    assert.deepEqual(codes(parsed.diagnostics), ["emptyFile"]);
    assert.equal(parsed.diagnostics[0]?.location, undefined);
    assert.equal(parsed.data.entries.length, 0);
  }
});

test("quoted class lists and backslash filenames stay install-relative", () => {
  const cells = new Array<string>(26).fill("");
  cells[0] = "wave";
  cells[1] = "testQuoted";
  cells[2] = "sounds\\test-win.wav";
  cells[3] = "invented";
  cells[13] = "4";
  cells[17] = '"Test Effects, Test Shields"';
  const parsed = parseSounds(cells.join("\t"));
  assert.deepEqual(codes(parsed.diagnostics), []);
  assert.equal(parsed.data.entries[0]?.filename, "sounds/test-win.wav");
  assert.deepEqual(parsed.data.entries[0]?.classes, ["Test Effects", "Test Shields"]);
});
