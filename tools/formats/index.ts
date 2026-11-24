/**
 * Browser-safe shiplist and ftrlist parsers.
 * Synthetic fixtures only — never original game tables.
 */

export {
  makeDiagnostic,
  type Diagnostic,
  type DiagnosticLocation,
  type DiagnosticSource,
  type ParseOptions,
  type ParseResult,
  type Severity,
} from "./diagnostics.ts";

export { compareSpecCopies, normalizeInstallPath } from "./text.ts";

export {
  ARC_CODES,
  PLA_CODES,
  RELOAD_COUNTED,
  RELOAD_TOKENS,
  WEAPON_DEFS,
  interpretWeaponArc,
} from "./weapons.ts";

export { parseShiplist, type HardpointSlot, type Shiplist, type ShiplistRow } from "./shiplist.ts";

export {
  parseSounds,
  SOUND_FILE_TYPES,
  type SoundClass,
  type SoundEntry,
  type SoundIndex,
  type SoundParseOptions,
} from "./sounds.ts";

export {
  parseFtrlist,
  type FighterWeapon,
  type Ftrlist,
  type FtrlistParseOptions,
  type FtrlistRow,
} from "./ftrlist.ts";

export {
  DIAGNOSTIC_SOURCES,
  diagnostic,
  installRelativeFile,
  machinePathLeak,
} from "./src/diagnostic.ts";

export {
  BMP_COLOR_KEYS,
  BMP_MAX_DIMENSION,
  parseBmp,
  type BmpColorKey,
  type DecodedBmp,
  type ParseBmpOptions,
} from "./src/bmp.ts";

export { encodeBmp, type BmpEncodeOptions } from "./src/encode-bmp.ts";

export {
  SELF_ILLUM_STEM,
  pairSelfIllumination,
  type SelfIllumIndex,
  type TexturePairRef,
} from "./src/self-illum.ts";

export {
  MOD_MATERIAL_FLAGS,
  MOD_MAX_CORNERS,
  MOD_MAX_FACES,
  MOD_MAX_FILE_BYTES,
  MOD_MAX_LODS,
  MOD_MAX_MATERIALS,
  MOD_MAX_POINTS,
  MOD_MAX_VERTICES,
  MOD_PUBLISHED_LOD_MAX,
  breakupModelPath,
  parseMod,
  type ModCorner,
  type ModFace,
  type ModLod,
  type ModMaterial,
  type ModModel,
  type ModNamedPoint,
  type ModTextureRef,
  type ModUnknownChunk,
  type ParseModOptions,
} from "./src/mod.ts";
