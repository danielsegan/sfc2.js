/**
 * Token lists and header aliases from docs/formats and docs/rules/shiplist-mapping.md.
 * Lookup is case-insensitive. Stored cell text keeps the file's case.
 */

export const RACE_TOKENS = [
  "Federation",
  "Klingon",
  "Romulan",
  "Lyran",
  "Hydran",
  "Gorn",
  "Orion",
  "Neutral",
  "Monster",
  "ISC",
  "Mirak",
] as const;

/**
 * S1 hull tokens plus the extra CE 2.670 tokens from the sfc2-ci inventory
 * (names only). DD, BC and PF were not in that vocabulary.
 */
export const HULL_TOKENS = [
  "FF",
  "CL",
  "CA",
  "DN",
  "BS",
  "BT",
  "F",
  "KDP",
  "KLP",
  "KSD",
  "SHT",
  "FTR",
  "XMN",
  "Planet",
  "Asteroid",
  "Star",
  "UNKNOWN",
  "BOX",
  "MAM",
  "MDM",
  "MLC",
  "MMT",
  "MSG",
  "MSS",
  "SB",
] as const;

/** Playable hulls that must name a geometry (V12). */
export const PLAYABLE_HULLS = ["FF", "CL", "CA", "DN"] as const;

/** docs/formats/shiplist.md §4.2: AA and A–H. H is stationary. */
export const TURN_TOKENS = ["AA", "A", "B", "C", "D", "E", "F", "G", "H"] as const;

function tokenSet(tokens: readonly string[]): Set<string> {
  return new Set(tokens.map((token) => token.toLowerCase()));
}

const RACES = tokenSet(RACE_TOKENS);
const HULLS = tokenSet(HULL_TOKENS);
const PLAYABLE = tokenSet(PLAYABLE_HULLS);
const TURNS = tokenSet(TURN_TOKENS);

export function isKnownRace(value: string): boolean {
  return RACES.has(value.trim().toLowerCase());
}

export function isKnownHull(value: string): boolean {
  return HULLS.has(value.trim().toLowerCase());
}

export function isPlayableHull(value: string): boolean {
  return PLAYABLE.has(value.trim().toLowerCase());
}

export function isKnownTurn(value: string): boolean {
  return TURNS.has(value.trim().toLowerCase());
}

export const SHIP_STRING_ALIASES: Record<string, string> = {
  race: "race",
  "hull type": "hullType",
  hulltype: "hullType",
  hull: "hullType",
  class: "className",
  "class name": "className",
  classname: "className",
  "special role": "specialRole",
  specialrole: "specialRole",
  role: "specialRole",
  "turn mode": "turnMode",
  turnmode: "turnMode",
  "refit base class": "refitBaseClass",
  refitbaseclass: "refitBaseClass",
  "refit base": "refitBaseClass",
  refit: "refitBaseClass",
  geometry: "geometry",
  ui: "uiKey",
  "ui key": "uiKey",
  uikey: "uiKey",
  "class type": "classType",
  "full name": "displayName",
  "fighter type 1": "fighterType0",
  "fighter type 2": "fighterType1",
  "fighter type 3": "fighterType2",
  "fighter type 4": "fighterType3",
};

export const SHIP_NUMBER_ALIASES: Record<string, string> = {
  bpv: "bpv",
  "year first available": "yearFirstAvailable",
  yearfirstavailable: "yearFirstAvailable",
  "year first": "yearFirstAvailable",
  "first year": "yearFirstAvailable",
  "first year avail": "yearFirstAvailable",
  "year last available": "yearLastAvailable",
  yearlastavailable: "yearLastAvailable",
  "year last": "yearLastAvailable",
  "last year": "yearLastAvailable",
  "last year avail": "yearLastAvailable",
  "size class": "sizeClass",
  sizeclass: "sizeClass",
  size: "sizeClass",
  "move cost": "moveCost",
  movecost: "moveCost",
  "het chance": "hetChance",
  hetchance: "hetChance",
  "het +2 turns & nimble": "hetChance",
  "het breakdown": "hetBreakdown",
  hetbreakdown: "hetBreakdown",
  stealth: "stealth",
  "stealth (+ecm)": "stealth",
  crew: "crew",
  "regular crew": "crew",
  "boarding parties base": "boardingPartiesBase",
  boardingpartiesbase: "boardingPartiesBase",
  "boarding parties": "boardingPartiesBase",
  "boarding parties max": "boardingPartiesMax",
  "deck crews": "deckCrews",
  deckcrews: "deckCrews",
  "total crew": "totalCrew",
  totalcrew: "totalCrew",
  "min crew": "minCrew",
  mincrew: "minCrew",
  "shield 1": "shieldFront",
  "shield front": "shieldFront",
  "front shield": "shieldFront",
  "shield 2": "shieldForwardSide",
  "shield 2 _ 6": "shieldForwardSide",
  "shield forward side": "shieldForwardSide",
  "forward side": "shieldForwardSide",
  "shield 3": "shieldAftSide",
  "shield 3 _ 5": "shieldAftSide",
  "shield aft side": "shieldAftSide",
  "aft side": "shieldAftSide",
  "shield 4": "shieldRear",
  "shield rear": "shieldRear",
  "rear shield": "shieldRear",
  "shield total": "shieldTotal",
  shieldtotal: "shieldTotal",
  "total shields": "shieldTotal",
  cloak: "cloakCost",
  "cloak cost": "cloakCost",
  cloakcost: "cloakCost",
  probes: "probes",
  "transporter bombs base": "tBombsBase",
  "t-bombs base": "tBombsBase",
  "t bombs base": "tBombsBase",
  "tbombs base": "tBombsBase",
  "transporter bombs max": "tBombsMax",
  "t-bombs max": "tBombsMax",
  "t bombs max": "tBombsMax",
  "nuclear mines base": "nuclearMinesBase",
  "nuclear mine base": "nuclearMinesBase",
  "nuclear mines max": "nuclearMinesMax",
  "nuclear mine max": "nuclearMinesMax",
  "drone control": "droneControl",
  "drone rack b": "droneControl",
  add6: "add6",
  "add 6": "add6",
  add_6: "add6",
  add12: "add12",
  "add 12": "add12",
  add_12: "add12",
  "shuttle bay capacity": "shuttleBayCapacity",
  "shuttles size": "shuttleBayCapacity",
  "launch rate": "launchRate",
  "admin shuttles base": "adminShuttlesBase",
  "general base": "adminShuttlesBase",
  "admin shuttles max": "adminShuttlesMax",
  "general max": "adminShuttlesMax",
  "suicide shuttles base": "suicideShuttlesBase",
  "suicide shuttles max": "suicideShuttlesMax",
  "scatter packs base": "scatterPacksBase",
  "scatter packs max": "scatterPacksMax",
  "wild weasels base": "wildWeaselsBase",
  "wild weasels max": "wildWeaselsMax",
  "replacement shuttles": "replacementShuttles",
  "fighter bay 1": "fighterBay0",
  "fighter bay 2": "fighterBay1",
  "fighter bay 3": "fighterBay2",
  "fighter bay 4": "fighterBay3",
  armor: "armor",
  "hull forward": "hullForward",
  "forward hull": "hullForward",
  "hull center": "hullCenter",
  "hull centre": "hullCenter",
  "center hull": "hullCenter",
  "centre hull": "hullCenter",
  "hull aft": "hullAft",
  "aft hull": "hullAft",
  cargo: "cargo",
  barracks: "barracks",
  repair: "repair",
  "warp side": "warpSide",
  "side warp": "warpSide",
  r_l_warp: "warpSide",
  "warp center": "warpCenter",
  "warp centre": "warpCenter",
  c_warp: "warpCenter",
  impulse: "impulse",
  apr: "apr",
  battery: "battery",
  bridge: "bridge",
  security: "security",
  lab: "lab",
  labs: "lab",
  transporters: "transporters",
  tractors: "tractors",
  "mech tractors": "mechTractors",
  "special sensors": "specialSensors",
  sensors: "sensors",
  scanners: "scanners",
  "explosion strength": "explosionStrength",
  acceleration: "acceleration",
  "damage control": "damageControl",
  "extra damage": "extraDamage",
  cost: "cost",
  "ship cost": "cost",
  "refit cost": "refitCost",
  "sfb year first available": "sfbYearFirstAvailable",
  "sfb year last available": "sfbYearLastAvailable",
};

/** CE 2.670 ftrlist headers from docs/rules/shiplist-mapping.md §5, plus the minimal fixture's labels. */
export const FTR_STRING_ALIASES: Record<string, string> = {
  race: "race",
  type: "typeName",
  "type name": "typeName",
  typename: "typeName",
  "ship class": "shipClassRef",
  "ship class ref": "shipClassRef",
  shipclassref: "shipClassRef",
  ui: "uiKey",
  "ui key": "uiKey",
  geometry: "geometry",
  name: "displayName",
  "display name": "displayName",
};

export const FTR_NUMBER_ALIASES: Record<string, string> = {
  speed: "speed",
  damage: "damagePoints",
  "ground attack bonus": "groundAttackBonus",
  ecm: "ecm",
  eccm: "eccm",
  bpv: "bpv",
  "carrier size class": "carrierSizeClass",
  "first year avail": "yearFirstAvailable",
  "last year avail": "yearLastAvailable",
  "year first": "yearFirstAvailable",
  "year last": "yearLastAvailable",
  "year first available": "yearFirstAvailable",
  "year last available": "yearLastAvailable",
  "first year": "yearFirstAvailable",
  "last year": "yearLastAvailable",
  size: "sizeClass",
  "size class": "sizeClass",
  add_6: "add6",
  "add 6": "add6",
  add6: "add6",
};

export function isCountHeader(norm: string): boolean {
  return norm === "num" || norm === "count" || norm === "number";
}

export function isArcHeader(norm: string): boolean {
  return norm === "arc" || norm === "firing arc";
}

export function isShotsHeader(norm: string): boolean {
  return norm === "shots" || norm === "load";
}

/** File slot 1–25 → slotIndex 0–24. Accepts `Heavy Weapon N` and `Weapon N`. */
export function shipWeaponSlot(norm: string): number | null {
  const match = /^(?:heavy weapon|weapon)\s+(\d+)$/.exec(norm);
  if (!match) return null;
  const slot = Number(match[1]);
  if (!Number.isInteger(slot) || slot < 1 || slot > 25) return null;
  return slot - 1;
}

/** `Weapon1` … `Weapon5`, with or without a space. */
export function fighterWeaponSlot(norm: string): number | null {
  const match = /^weapon\s*(\d+)$/.exec(norm);
  if (!match) return null;
  const slot = Number(match[1]);
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) return null;
  return slot - 1;
}
