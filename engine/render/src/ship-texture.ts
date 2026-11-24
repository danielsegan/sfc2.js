/**
 * Upload a decoded BMP pair as three.js textures and a ship material.
 *
 * The base map is sRGB. The self-illum map stays sRGB too: three.js
 * converts emissive samples to linear in the shader, which keeps the
 * 8-bit values intact. UV (0, 0) is the bottom-left of the image
 * (`texture.flipY`), matching docs/ui/asset-pipeline.md §4.
 * A glow map may differ in size from its base; both are sampled by UV.
 */

import {
  diagnostic,
  parseBmp,
  type BmpColorKey,
  type DecodedBmp,
  type Diagnostic,
  type ParseResult,
  type TexturePairRef,
} from '@sfc2js/formats';
import type { Vfs } from '@sfc2js/platform';
import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type Material,
  type Texture,
} from 'three';

export const RENDER_TIERS = ['period', 'hd'] as const;
export type RenderTier = (typeof RENDER_TIERS)[number];

/**
 * Starting HD bloom cutoff in linear luminance. The post-process that
 * reads `material.userData.selfIllumBloomThreshold` is not part of this
 * loader. Tune it against a real install before treating it as final.
 */
export const HD_SELF_ILLUM_BLOOM_THRESHOLD = 0.15;

export interface LoadShipTextureOptions {
  tier?: RenderTier;
  /** Applied to the base texture only. Glow maps stay unkeyed. */
  colorKey?: BmpColorKey;
}

export interface LoadedShipTexture {
  basePath: string;
  selfIllumPath: string | null;
  decodedBase: DecodedBmp | null;
  decodedSelfIllum: DecodedBmp | null;
  baseTexture: Texture | null;
  selfIllumTexture: Texture | null;
  /**
   * Period: Lambert, emissive added on top of the lit base.
   * HD: standard material, same emissive map, plus the bloom hint.
   * Null when the base image could not be decoded.
   */
  material: Material | null;
}

export async function loadShipTexture(
  vfs: Vfs,
  pair: TexturePairRef,
  options?: LoadShipTextureOptions,
): Promise<ParseResult<LoadedShipTexture>> {
  const tier = options?.tier ?? 'period';
  const colorKey = options?.colorKey ?? 'none';
  const diagnostics: Diagnostic[] = [];

  const baseBytes = await readFile(vfs, pair.basePath, diagnostics);
  const decodedBase = baseBytes === null ? null : parseBmp(baseBytes, { file: pair.basePath, colorKey });
  if (decodedBase !== null) diagnostics.push(...decodedBase.diagnostics);

  const baseOk = decodedBase !== null && decodedBase.data.width > 0 && !hasError(decodedBase.diagnostics);
  const baseTexture =
    baseOk && decodedBase !== null
      ? textureFromDecoded(decodedBase.data, pair.basePath, 'base', tier)
      : null;

  let decodedSelf: ParseResult<DecodedBmp> | null = null;
  let selfIllumPath: string | null = null;
  if (pair.selfIllumPath !== undefined) {
    selfIllumPath = pair.selfIllumPath;
    const glowBytes = await readFile(vfs, pair.selfIllumPath, diagnostics);
    if (glowBytes !== null) {
      decodedSelf = parseBmp(glowBytes, { file: pair.selfIllumPath, colorKey: 'none' });
      diagnostics.push(...decodedSelf.diagnostics);
    }
  }

  const glowDecoded = decodedSelf !== null && decodedSelf.data.width > 0 && !hasError(decodedSelf.diagnostics)
    ? decodedSelf.data
    : null;
  const selfIllumTexture =
    glowDecoded !== null
      ? textureFromDecoded(glowDecoded, selfIllumPath ?? pair.basePath, 'selfIllum', tier)
      : null;

  if (decodedBase !== null && baseTexture !== null && glowDecoded !== null) {
    if (decodedBase.data.width !== glowDecoded.width || decodedBase.data.height !== glowDecoded.height) {
      diagnostics.push(
        diagnostic('selfIllumSizeMismatch', 'bmp', 'info', {
          details: {
            baseWidth: decodedBase.data.width,
            baseHeight: decodedBase.data.height,
            illumWidth: glowDecoded.width,
            illumHeight: glowDecoded.height,
          },
          location: { file: pair.basePath },
        }),
      );
    }
  }

  const material =
    baseTexture === null || decodedBase === null
      ? null
      : createShipMaterial(tier, baseTexture, selfIllumTexture, decodedBase.data.hasTransparency);

  return {
    data: {
      basePath: pair.basePath,
      selfIllumPath,
      decodedBase: decodedBase?.data ?? null,
      decodedSelfIllum: decodedSelf?.data ?? null,
      baseTexture,
      selfIllumTexture,
      material,
    },
    diagnostics,
  };
}

export function textureFromDecoded(
  decoded: DecodedBmp,
  installPath: string,
  role: 'base' | 'selfIllum',
  tier: RenderTier,
): DataTexture {
  const texture = new DataTexture(
    new Uint8Array(decoded.rgba),
    decoded.width,
    decoded.height,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.name = installPath;
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.generateMipmaps = true;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = tier === 'hd' ? LinearMipmapLinearFilter : LinearFilter;
  texture.anisotropy = tier === 'hd' ? 8 : 1;
  texture.unpackAlignment = 1;
  texture.userData = { installPath, role };
  texture.needsUpdate = true;
  return texture;
}

function createShipMaterial(
  tier: RenderTier,
  base: Texture,
  selfIllum: Texture | null,
  hasTransparency: boolean,
): Material {
  const emissive = new Color(selfIllum === null ? 0x000000 : 0xffffff);
  const material =
    tier === 'hd'
      ? new MeshStandardMaterial({
          map: base,
          roughness: 0.6,
          metalness: 0,
          emissive,
          emissiveMap: selfIllum,
          emissiveIntensity: 1,
          transparent: hasTransparency,
          premultipliedAlpha: hasTransparency,
        })
      : new MeshLambertMaterial({
          map: base,
          emissive,
          emissiveMap: selfIllum,
          emissiveIntensity: 1,
          transparent: hasTransparency,
          premultipliedAlpha: hasTransparency,
        });
  material.userData = {
    sfc2Role: 'ship-surface',
    tier,
    selfIllumBloomThreshold: tier === 'hd' && selfIllum !== null ? HD_SELF_ILLUM_BLOOM_THRESHOLD : 0,
  };
  return material;
}

async function readFile(vfs: Vfs, path: string, diagnostics: Diagnostic[]): Promise<Uint8Array | null> {
  try {
    const bytes = await vfs.read(path);
    if (bytes === null) {
      diagnostics.push(
        diagnostic('missingTexture', 'bmp', 'error', {
          details: { path },
          location: { file: path },
        }),
      );
      return null;
    }
    return bytes;
  } catch {
    diagnostics.push(
      diagnostic('permissionDenied', 'importer', 'error', { location: { file: path } }),
    );
    return null;
  }
}

function hasError(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === 'error');
}
