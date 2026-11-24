import { describe, expect, it } from 'vitest';
import { parseMod } from '@sfc2js/formats';
import { createVfs } from '@sfc2js/platform';
import { Mesh } from 'three';
import { buildShipMesh } from '@sfc2js/render';
import { FIXTURE_MODEL_DIR, placeholderGlow, placeholderHullMod, placeholderTexture } from './placeholder-mod.ts';

describe('synthetic hull fixture', () => {
  it('parses and builds a mesh without a game file', async () => {
    const modelPath = `${FIXTURE_MODEL_DIR}/wedge-a.mod`;
    const parsed = parseMod(placeholderHullMod({ r: 79, g: 143, b: 214 }), { file: modelPath });
    expect(parsed.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(parsed.data.lods[0]?.faces.length).toBe(4);
    expect(parsed.data.namedPoints[0]?.name).toBe('NOSE');
    const base = placeholderTexture();
    const glow = placeholderGlow();
    const vfs = createVfs([
      { path: `${FIXTURE_MODEL_DIR}/Wedge1.bmp`, size: base.length, read: async () => base },
      { path: `${FIXTURE_MODEL_DIR}/Wedge1i.bmp`, size: glow.length, read: async () => glow },
    ]);
    const built = await buildShipMesh(parsed.data, { vfs, modelPath, tier: 'period' });
    expect(built.diagnostics.filter((item) => item.severity === 'error')).toEqual([]);
    expect(built.data.lods[0]?.children[0]).toBeInstanceOf(Mesh);
    expect(built.data.attachments[0]?.name).toBe('NOSE');
  });
});
