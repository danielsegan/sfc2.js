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
  parseFtrlist,
  type FighterWeapon,
  type Ftrlist,
  type FtrlistParseOptions,
  type FtrlistRow,
} from "./ftrlist.ts";
