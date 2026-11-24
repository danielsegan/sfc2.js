export {
  DIAGNOSTIC_SOURCES,
  diagnostic,
  installRelativeFile,
  machinePathLeak,
  type Diagnostic,
  type DiagnosticLocation,
  type DiagnosticSource,
  type ParseResult,
  type Severity,
} from './diagnostic.ts';

export {
  BMP_COLOR_KEYS,
  BMP_MAX_DIMENSION,
  parseBmp,
  type BmpColorKey,
  type DecodedBmp,
  type ParseBmpOptions,
} from './bmp.ts';

export { encodeBmp, type BmpEncodeOptions } from './encode-bmp.ts';

export {
  SELF_ILLUM_STEM,
  pairSelfIllumination,
  type SelfIllumIndex,
  type TexturePairRef,
} from './self-illum.ts';
