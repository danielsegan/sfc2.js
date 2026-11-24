import { describe, expect, it } from 'vitest';
import { parseMod } from '@sfc2js/formats';
import { createVfs } from '@sfc2js/platform';
import { Mesh } from 'three';
import { buildShipMesh } from '@sfc2js/render';
import { FIXTURE_MODEL_DIR, placeholderGlow, placeholderHullMod, placeholderTexture } from './placeholder-mod.ts';

function extent(vertices: Float32Array): { maxX: number; maxAbsZ: number } {
  let maxX = 0;
  let maxAbsZ = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] ?? 0;
    const z = vertices[i + 2] ?? 0;
    const absZ = z < 0 ? -z : z;
    if (x > maxX) maxX = x;
    if (absZ > maxAbsZ) maxAbsZ = absZ;
  }
  return { maxX, maxAbsZ };
}

describe('synthetic hull fixture', () => {
  it('builds an original saucer cruiser and a longer-boom cruiser', async () => {
    const caBytes = placeholderHullMod({ r: 79, g: 143, b: 214 }, 'ca');
    const d7Bytes = placeholderHullMod({ r: 178, g: 58, b: 58 }, 'd7');
    expect(caBytes).not.toEqual(d7Bytes);
    const ca = parseMod(caBytes, { file: `${FIXTURE_MODEL_DIR}/test-ca.mod` });
    const d7 = parseMod(d7Bytes, { file: `${FIXTURE_MODEL_DIR}/test-d7.mod` });
    expect(ca.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(d7.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(ca.data.lods[0]?.faces.length).toBeGreaterThan(8);
    expect(d7.data.lods[0]?.faces.length).toBeGreaterThan(8);
    expect(ca.data.namedPoints[0]?.name).toBe('NOSE');
    expect(d7.data.namedPoints[0]?.name).toBe('NOSE');
    const caSpan = extent(ca.data.lods[0]?.vertices ?? new Float32Array());
    const d7Span = extent(d7.data.lods[0]?.vertices ?? new Float32Array());
    expect(caSpan.maxAbsZ).toBeGreaterThan(0.6);
    expect(d7Span.maxX).toBeGreaterThan(caSpan.maxX);
    expect(d7Span.maxAbsZ).toBeGreaterThan(0.7);
    const base = placeholderTexture();
    const glow = placeholderGlow();
    const vfs = createVfs([
      { path: `${FIXTURE_MODEL_DIR}/Hull.bmp`, size: base.length, read: async () => base },
      { path: `${FIXTURE_MODEL_DIR}/HullGlow.bmp`, size: glow.length, read: async () => glow },
    ]);
    const built = await buildShipMesh(ca.data, { vfs, modelPath: `${FIXTURE_MODEL_DIR}/test-ca.mod`, tier: 'period' });
    expect(built.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(built.data.lods[0]?.children[0]).toBeInstanceOf(Mesh);
    expect(built.data.attachments[0]?.name).toBe('NOSE');
  });
});
