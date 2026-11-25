/**
 * Property tests for the Phase 1 parsers (#20).
 * Every case is synthetic. A parser must return a result for malformed
 * input: it must not throw, and a bounded input must not hang.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import fc from "fast-check";

import {
  BMP_MAX_DIMENSION,
  installRelativeFile,
  parseBmp,
  parseFtrlist,
  parseMod,
  parseShiplist,
  parseSounds,
  type Diagnostic,
  type ParseResult,
} from "./index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BUDGET_MS = 500;
const RUNS = 80;

const SEVERITIES = new Set(["error", "warning", "info"]);

function readFixture(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function timed<T>(fn: () => T): T {
  const start = performance.now();
  const value = fn();
  const elapsed = performance.now() - start;
  assert.ok(elapsed < BUDGET_MS, `parser took ${elapsed.toFixed(1)}ms`);
  return value;
}

function assertDiagnostics(diagnostics: Diagnostic[], sources: ReadonlySet<string>): void {
  assert.ok(Array.isArray(diagnostics));
  for (const item of diagnostics) {
    assert.equal(typeof item.code, "string");
    assert.ok(item.code.length > 0);
    assert.ok(sources.has(item.source), item.source);
    assert.ok(SEVERITIES.has(item.severity), item.severity);
    const file = item.location?.file;
    if (file !== undefined) {
      assert.equal(installRelativeFile(file), file);
      assert.equal(file.includes("\\"), false);
    }
  }
}

function assertText(result: ParseResult<{ rows?: unknown[]; classes?: unknown[]; entries?: unknown[] }>, sources: ReadonlySet<string>): void {
  assert.ok(result.data !== null && typeof result.data === "object");
  assertDiagnostics(result.diagnostics, sources);
}

function assertShip(result: ReturnType<typeof parseShiplist>): void {
  assertText(result, new Set(["shiplist", "loader"]));
  for (const row of result.data.rows) {
    assert.ok(row.line >= 1);
    assert.equal(row.hardpoints.length, 25);
    assert.ok(Array.isArray(row.raw));
    assert.equal(Object.getPrototypeOf(row.fields), Object.prototype);
  }
}

function assertFighter(result: ReturnType<typeof parseFtrlist>): void {
  assertText(result, new Set(["ftrlist", "loader"]));
  for (const row of result.data.rows) {
    assert.ok(row.line >= 1);
    assert.ok(row.weapons.length <= 5);
    for (const weapon of row.weapons) {
      assert.ok(weapon.slotIndex >= 0 && weapon.slotIndex <= 4);
    }
    assert.equal(Object.getPrototypeOf(row.fields), Object.prototype);
  }
}

function assertSounds(result: ReturnType<typeof parseSounds>): void {
  assertText(result, new Set(["sounds"]));
  assert.ok(Array.isArray(result.data.classes));
  assert.ok(Array.isArray(result.data.entries));
}

function assertModel(result: ReturnType<typeof parseMod>): void {
  assert.ok(result.data !== null);
  assertDiagnostics(result.diagnostics, new Set(["mod"]));
  assert.ok(result.data.lods.length <= 8);
  assert.ok(result.data.materials.length <= 256);
  assert.ok(result.data.namedPoints.length <= 4096);
  for (const lod of result.data.lods) {
    assert.equal(lod.vertices.length % 3, 0);
    assert.ok(lod.vertices.length / 3 <= 65536);
    assert.ok(lod.faces.length <= 65536);
    for (const face of lod.faces) assert.ok(face.vertices.length <= 8);
  }
}

function assertBitmap(result: ReturnType<typeof parseBmp>): void {
  assertDiagnostics(result.diagnostics, new Set(["bmp"]));
  const failed = result.diagnostics.some((item) => item.severity === "error");
  if (failed) {
    assert.equal(result.data.width, 0);
    assert.equal(result.data.height, 0);
    assert.equal(result.data.rgba.length, 0);
    return;
  }
  assert.ok(result.data.width >= 1 && result.data.width <= BMP_MAX_DIMENSION);
  assert.ok(result.data.height >= 1 && result.data.height <= BMP_MAX_DIMENSION);
  assert.equal(result.data.rgba.length, result.data.width * result.data.height * 4);
}

const check = { numRuns: RUNS, seed: 0x5fc21314 } as const;

const bytesArb = fc.uint8Array({ minLength: 0, maxLength: 1536 });
// binary-ascii covers 0x00–0xFF. Windows-1252 only round-trips 0x00–0x7F.
const asciiArb = fc
  .string({ unit: "binary-ascii", minLength: 0, maxLength: 512 })
  .map((text) => Array.from(text, (char) => (char.charCodeAt(0) < 128 ? char : " ")).join(""));
const binaryTextArb = fc.string({ unit: "binary", minLength: 0, maxLength: 768 });
const fileArb = fc.oneof(
  fc.constant(undefined),
  fc.constant("Assets/Specs/shiplist.txt"),
  fc.constant("C:/Users/secret/shiplist.txt"),
  fc.constant("Assets/../shiplist.txt"),
  fc.constant("\\\\server\\share\\shiplist.txt"),
);

const cellArb = fc.oneof(
  fc.string({ unit: "binary-ascii", maxLength: 16 }),
  fc.integer({ min: -10000, max: 10000 }).map(String),
  fc.constantFrom("", " ", "NaN", "Infinity", "1e9", "__proto__", "constructor", "1.2.3", "+", "-", "0x10"),
);
const tableArb = fc
  .array(fc.array(cellArb, { minLength: 0, maxLength: 8 }), { minLength: 0, maxLength: 6 })
  .map((rows) => rows.map((row) => row.join("\t")).join("\n"));

function chunk(type: string, payload: Uint8Array<ArrayBufferLike>): Uint8Array {
  const padded = (payload.length + 3) & ~3;
  const out = new Uint8Array(8 + padded);
  const view = new DataView(out.buffer);
  out[0] = type.charCodeAt(0);
  out[1] = type.charCodeAt(1);
  out[2] = type.charCodeAt(2);
  out[3] = type.charCodeAt(3);
  view.setInt32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

function concat(parts: Uint8Array<ArrayBufferLike>[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function looseChunk(id: Uint8Array<ArrayBufferLike>, declaredSize: number, payload: Uint8Array<ArrayBufferLike>): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  out.set(id.subarray(0, 4), 0);
  new DataView(out.buffer).setInt32(4, declaredSize, true);
  out.set(payload, 8);
  return out;
}

const looseChunkArb = fc
  .record({
    id: fc.uint8Array({ minLength: 4, maxLength: 4 }),
    declaredSize: fc.integer({ min: -32, max: 96 }),
    payload: fc.uint8Array({ minLength: 0, maxLength: 48 }),
  })
  .map(({ id, declaredSize, payload }) => looseChunk(id, declaredSize, payload));

const chunkStreamArb = fc.array(looseChunkArb, { minLength: 0, maxLength: 6 }).map((parts) => concat(parts));

function tinyModel(): Uint8Array {
  const header = new Uint8Array(36);
  const view = new DataView(header.buffer);
  view.setUint32(0, 1, true);
  view.setFloat32(4, 3.5, true);
  view.setInt32(8, 0, true);
  return chunk("MDLS", header);
}

function bmpInfo(width: number, height: number, bitCount: number): Uint8Array {
  const bytes = new Uint8Array(54);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  const view = new DataView(bytes.buffer);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, bitCount, true);
  view.setUint32(30, 0, true);
  return bytes;
}

test("property: text parsers accept arbitrary bytes, ASCII, and tables", { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(bytesArb, asciiArb, binaryTextArb, tableArb, fileArb, (bytes, ascii, binary, table, file) => {
      const texts = [new TextDecoder("windows-1252").decode(bytes), ascii, binary, table];
      for (const text of texts) {
        assertShip(timed(() => parseShiplist(text, { file, checkVocabulary: true })));
        assertShip(timed(() => parseShiplist(text, { file, checkVocabulary: false })));
        assertFighter(timed(() => parseFtrlist(text, { file, checkVocabulary: false })));
        assertSounds(timed(() => parseSounds(text, { file })));
      }
      assertShip(timed(() => parseShiplist(bytes, { checkVocabulary: false })));
      assertFighter(timed(() => parseFtrlist(bytes)));
      assertSounds(timed(() => parseSounds(bytes)));
    }),
    check,
  );
});

test("property: ASCII text matches its byte decoding", { timeout: 30_000 }, () => {
  fc.assert(
    fc.property(asciiArb, (ascii) => {
      const bytes = Uint8Array.from(ascii, (char) => char.charCodeAt(0));
      assert.deepEqual(
        timed(() => parseShiplist(ascii, { checkVocabulary: false })),
        timed(() => parseShiplist(bytes, { checkVocabulary: false })),
      );
      assert.deepEqual(timed(() => parseFtrlist(ascii)), timed(() => parseFtrlist(bytes)));
      assert.deepEqual(timed(() => parseSounds(ascii)), timed(() => parseSounds(bytes)));
    }),
    check,
  );
});

test("property: mod and BMP accept arbitrary bytes, including a non-zero view offset", { timeout: 60_000 }, () => {
  fc.assert(
    fc.property(bytesArb, chunkStreamArb, fileArb, (bytes, stream, file) => {
      const modFile = file === undefined ? undefined : file.replace("shiplist.txt", "Hull.mod");
      for (const sample of [bytes, stream]) {
        assertModel(timed(() => parseMod(sample, { file: modFile })));
        const holder = new Uint8Array(sample.length + 7);
        holder.set(sample, 3);
        const view = holder.subarray(3, 3 + sample.length);
        assert.deepEqual(
          timed(() => parseMod(sample)),
          timed(() => parseMod(view)),
        );
        assertBitmap(timed(() => parseBmp(sample, { file: modFile?.replace(/\.mod$/i, ".bmp") })));
        assert.deepEqual(timed(() => parseBmp(sample)), timed(() => parseBmp(view)));
      }
    }),
    check,
  );
});

test("property: an oversized BMP header allocates no pixels", { timeout: 30_000 }, () => {
  fc.assert(
    fc.property(
      fc.integer({ min: BMP_MAX_DIMENSION + 1, max: 2_000_000_000 }),
      fc.integer({ min: -2_000_000_000, max: -BMP_MAX_DIMENSION - 1 }),
      fc.constantFrom(4, 8, 24, 32),
      (width, height, bitCount) => {
        const wide = timed(() => parseBmp(bmpInfo(width, 1, bitCount)));
        const tall = timed(() => parseBmp(bmpInfo(1, height, bitCount)));
        assert.equal(wide.data.rgba.length, 0);
        assert.equal(tall.data.rgba.length, 0);
        assert.ok(wide.diagnostics.some((item) => item.code === "badDimensions"));
        assert.ok(tall.diagnostics.some((item) => item.code === "badDimensions"));
      },
    ),
    { numRuns: 40, seed: 0x5fc21314 },
  );
});

test("property: bytes appended to a tiny model do not drop the header", { timeout: 30_000 }, () => {
  const model = tinyModel();
  fc.assert(
    fc.property(fc.uint8Array({ minLength: 0, maxLength: 256 }), (tail) => {
      const merged = concat([model, tail]);
      const parsed = timed(() => parseMod(merged, { file: "C:/Games/Hull.mod" }));
      assertModel(parsed);
      assert.equal(parsed.data.version, 1);
      assert.equal(parsed.data.radius, 3.5);
      assert.equal(parsed.data.lodCount, 0);
      assert.ok(parsed.diagnostics.every((item) => item.location?.file === undefined));
    }),
    check,
  );
});

test("property: rows already read survive an appended line", { timeout: 30_000 }, () => {
  const ships = readFixture("tools/fixtures/formats/shiplist/minimal.txt");
  const fighters = readFixture("tools/fixtures/formats/ftrlist/minimal.txt");
  fc.assert(
    fc.property(binaryTextArb, (extra) => {
      const ship = timed(() => parseShiplist(`${ships}\n${extra}`, { checkVocabulary: false }));
      assertShip(ship);
      assert.deepEqual(
        ship.data.rows.slice(0, 3).map((row) => row.spawnKey),
        ["Federation:TEST-CA-01", "Klingon:TEST-FF-02", "Neutral:TEST-BS-03"],
      );
      const fighter = timed(() => parseFtrlist(`${fighters}\n${extra}`, { checkVocabulary: false }));
      assertFighter(fighter);
      assert.equal(fighter.data.rows[0]?.fields.Type, "TEST-FTR-01");
      assert.equal(fighter.data.rows[1]?.fields.Type, "TEST-PF-02");
    }),
    check,
  );
});

test("a __proto__ header is stored and does not replace the prototype", () => {
  const parsed = timed(() =>
    parseShiplist("__proto__\tClass\nTEST\tTEST-CA-01\n", { checkVocabulary: false }),
  );
  assert.equal(parsed.data.rows[0]?.fields["__proto__"], "TEST");
  assert.equal(parsed.data.rows[0]?.fields.Class, "TEST-CA-01");
  assert.equal(Object.getPrototypeOf(parsed.data.rows[0]?.fields), Object.prototype);

  const fighter = timed(() => parseFtrlist("__proto__\tType\nkept\tTEST-FTR-09\n", { checkVocabulary: false }));
  assert.equal(fighter.data.rows[0]?.fields["__proto__"], "kept");
  assert.equal(Object.getPrototypeOf(fighter.data.rows[0]?.fields), Object.prototype);
});

test("a drive letter or dot-dot file option is omitted from text diagnostics", () => {
  const text = "Race\tClass\tBPV\nFederation\tTEST-CA-01\tnope\n";
  for (const file of ["C:/Users/secret/shiplist.txt", "Assets/../shiplist.txt"]) {
    const parsed = parseShiplist(text, { file, checkVocabulary: false });
    assert.ok(parsed.diagnostics.some((item) => item.code === "badNumber"));
    assert.ok(parsed.diagnostics.every((item) => item.location?.file === undefined));
    assert.equal(parsed.data.rows[0]?.fields.BPV, 0);
  }
});

test("zero-size chunks, a negative size, and deep nesting finish", () => {
  const zeros = new Uint8Array(400 * 8);
  for (let i = 0; i < 400; i++) zeros.set([0x58, 0x58, 0x58, 0x58], i * 8);
  const flat = timed(() => parseMod(zeros));
  assertModel(flat);
  assert.equal(flat.diagnostics.filter((item) => item.code === "unknownChunk").length, 400);
  assert.ok(flat.diagnostics.some((item) => item.code === "missingHeader"));

  const negative = looseChunk(Uint8Array.from([0x4d, 0x44, 0x4c, 0x53]), -1, new Uint8Array(0));
  const stopped = timed(() => parseMod(negative));
  assert.ok(stopped.diagnostics.some((item) => item.code === "badCount"));

  let nested: Uint8Array<ArrayBufferLike> = new Uint8Array(4);
  for (let depth = 0; depth < 16; depth++) nested = chunk("MDLS", nested);
  const deep = timed(() => parseMod(nested));
  assertModel(deep);
  assert.ok(deep.diagnostics.some((item) => item.code === "truncated"));
});

test("the int32 height extreme allocates no pixels", () => {
  const parsed = timed(() => parseBmp(bmpInfo(1, -2147483648, 24)));
  assert.equal(parsed.data.rgba.length, 0);
  assert.ok(parsed.diagnostics.some((item) => item.code === "badDimensions"));
});

test("a wide synthetic table finishes and keeps every row", () => {
  const header = Array.from({ length: 80 }, (_, index) => `Col ${index}`).join("\t");
  const row = Array.from({ length: 80 }, () => "1").join("\t");
  const text = [header, ...Array.from({ length: 40 }, () => row)].join("\n");
  const parsed = timed(() => parseShiplist(text, { checkVocabulary: false }));
  assert.equal(parsed.data.rows.length, 40);
  assert.equal(parsed.data.columns.length, 80);
});

test("truncating a fixture never throws", () => {
  const ships = readFixture("tools/fixtures/formats/shiplist/minimal.txt");
  for (let cut = 0; cut <= ships.length; cut++) {
    assertShip(timed(() => parseShiplist(ships.slice(0, cut), { checkVocabulary: false })));
  }
});
