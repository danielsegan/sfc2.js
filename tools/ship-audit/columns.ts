/**
 * CE 2.670 shiplist column map.
 * Header names are the inventory metadata in
 * docs/formats/inventory/shiplist-ftrlist-ce-2.670.md (names only).
 * No ship rows and no install values.
 */

export type FieldStatus = "measured" | "assumed" | "unused";

export interface FieldColumn {
  index: number;
  /** Raw header. Empty string is the blank column at index 154. */
  column: string;
  parserField: string;
  consumer: string;
  transform: string;
  status: FieldStatus;
  /** True when sim and rules do not read the column. */
  ignored: boolean;
}

interface Ann {
  parser: string;
  consumer: string;
  transform: string;
  status: FieldStatus;
  ignored: boolean;
}

const SHIELD_CITE =
  "Measured on CE 2.670 (CE in-battle capture 2026-11-24; Shield Total = S1 + 2·S2_6 + 2·S3_5 + S4 held on all 1,157 CE rows).";

const ENGINE_SHIELD =
  "Engine loads 1:1 via docs/rules/data/measured.json (sideColumnFactor 1, endFactor 1) in engine/sim/bind-shiplist.ts shieldMaxFromCells.";

const MOUNT =
  "engine/sim/bind-shiplist.ts ShipSetup.mounts → engine/sim/combat.ts placeSetup";

/** Observed CE 2.670 header, column index 0..189. */
export const CE_HEADERS: readonly string[] = [
  "Race",
  "Hull Type",
  "Class",
  "Class Type",
  "BPV",
  "Special Role",
  "Year First Available",
  "Year Last Available",
  "Size Class",
  "Turn mode",
  "Move Cost",
  "HET +2 Turns & Nimble",
  "HET Breakdown",
  "Stealth (+ECM)",
  "Regular Crew",
  "Boarding Parties Base",
  "Boarding Parties Max",
  "Deck Crews",
  "Total Crew",
  "Min Crew",
  "Shield 1",
  "Shield 2 _ 6",
  "Shield 3 _ 5",
  "Shield 4",
  "Shield Total",
  "Cloak",
  "Num",
  "Heavy Weapon 1",
  "Arc",
  "Num",
  "Heavy Weapon 2",
  "Arc",
  "Num",
  "Heavy Weapon 3",
  "Arc",
  "Num",
  "Heavy Weapon 4",
  "Arc",
  "Num",
  "Heavy Weapon 5",
  "Arc",
  "Num",
  "Heavy Weapon 6",
  "Arc",
  "Num",
  "Heavy Weapon 7",
  "Arc",
  "Num",
  "Heavy Weapon 8",
  "Arc",
  "Num",
  "Heavy Weapon 9",
  "Arc",
  "Num",
  "Heavy Weapon 10",
  "Arc",
  "Num",
  "Weapon 11",
  "Arc",
  "Num",
  "Weapon 12",
  "Arc",
  "Num",
  "Weapon 13",
  "Arc",
  "Num",
  "Weapon 14",
  "Arc",
  "Num",
  "Weapon 15",
  "Arc",
  "Num",
  "Weapon 16",
  "Arc",
  "Num",
  "Weapon 17",
  "Arc",
  "Num",
  "Weapon 18",
  "Arc",
  "Num",
  "Weapon 19",
  "Arc",
  "Num",
  "Weapon 20",
  "Arc",
  "Num",
  "Weapon 21",
  "Arc",
  "Num",
  "Weapon 22",
  "Arc",
  "Num",
  "Weapon 23",
  "Arc",
  "Num",
  "Weapon 24",
  "Arc",
  "Num",
  "Weapon 25",
  "Arc",
  "Probes",
  "T Bombs Base",
  "T Bombs Max",
  "Nuclear Mine Base",
  "Nuclear Mine Max",
  "Drone Control",
  "ADD_6",
  "ADD_12",
  "Shuttles Size",
  "Launch Rate",
  "General Base",
  "General Max",
  "Fighter Bay 1",
  "Fighter Type 1",
  "Fighter Bay 2",
  "Fighter Type 2",
  "Fighter Bay 3",
  "Fighter Type 3",
  "Fighter Bay 4",
  "Fighter Type 4",
  "Armor",
  "Forward Hull",
  "Center Hull",
  "Aft Hull",
  "Cargo",
  "Barracks",
  "Repair",
  "R_L_Warp",
  "C_Warp",
  "Impulse",
  "Apr",
  "Battery",
  "Bridge",
  "Security",
  "Lab",
  "Transporters",
  "Tractors",
  "Mech Tractors",
  "Special Sensors",
  "Sensors",
  "Scanners",
  "Explosion Strength",
  "Acceleration",
  "Damage Control",
  "Extra Damage",
  "Ship Cost",
  "Refit Base Class",
  "Geometry",
  "UI",
  "Full Name",
  "refits",
  "Balance",
  "End",
  "",
  "W1",
  "W2",
  "W3",
  "W4",
  "W5",
  "W6",
  "W7",
  "W8",
  "W9",
  "W10",
  "W11",
  "W12",
  "W13",
  "W14",
  "W15",
  "W16",
  "W17",
  "W18",
  "W19",
  "W20",
  "W21",
  "W22",
  "W23",
  "W24",
  "W25",
  "Weapon BPV",
  "FB1",
  "FB2",
  "FB3",
  "FB4",
  "Fighter Subtotal",
  "System BPV",
  "BPV Subtotal",
  "SFB Year First Available",
  "SFB Year Last Available",
];

function raw(note: string): Ann {
  return {
    parser: "raw column (no role id; kept under the header name)",
    consumer: "none",
    transform: note,
    status: "unused",
    ignored: true,
  };
}

function unused(parser: string, note: string): Ann {
  return {
    parser,
    consumer: "none in engine/sim or engine/render",
    transform: note,
    status: "unused",
    ignored: true,
  };
}

function weaponAnn(index: number): Ann {
  const slot = Math.floor((index - 26) / 3);
  const part = (index - 26) % 3;
  const fileSlot = slot + 1;
  if (part === 0) {
    return {
      parser: `hardpoints[${slot}].count`,
      consumer: `${MOUNT} M.boxes (file slot ${fileSlot})`,
      transform:
        "×1. A positive Num becomes mount boxes. Num 0 or empty on a filled weapon becomes 1 in the loader; the audit treats that as a weapon-count mismatch.",
      status: "assumed",
      ignored: false,
    };
  }
  if (part === 1) {
    return {
      parser: `hardpoints[${slot}].weapon`,
      consumer: `${MOUNT} M.weaponId via engine/sim/rules-tables.ts weaponId (file slot ${fileSlot})`,
      transform:
        "Exact file code. Unknown codes are not mounted. Slots 1–10 use Heavy Weapon N. Slots 11–25 use Weapon N. W1–W25 are not these slots.",
      status: "assumed",
      ignored: false,
    };
  }
  return {
    parser: `hardpoints[${slot}].arc, or hardpoints[${slot}].reloads`,
    consumer: `${MOUNT} M.arcId via engine/sim/rules-tables.ts arcId (file slot ${fileSlot})`,
    transform:
      "Letter arcs stay exact. On DroA, DroB, DroC, DroF, DroG, ADD6 and ADD12, an Arc cell of 1, 2 or 3 is reloads and the firing arc is null.",
    status: "assumed",
    ignored: false,
  };
}

const STATIC: Record<number, Ann> = {
  0: {
    parser: "race",
    consumer: "tools/formats/shiplist.ts ShiplistRow.spawnKey; engine/duel/roster.ts spawnKey",
    transform: "Trimmed, case kept. Spawn key is race + ':' + class name.",
    status: "assumed",
    ignored: false,
  },
  1: {
    parser: "hullType",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.classCode → engine/sim/hull.ts H.classCode",
    transform: "FTR → CLASS_FIGHTER, PF → CLASS_PF, every other token → CLASS_SHIP. ×1.",
    status: "assumed",
    ignored: false,
  },
  2: {
    parser: "className",
    consumer: "tools/formats/shiplist.ts ShiplistRow.spawnKey; engine/duel/roster.ts className",
    transform: "Trimmed, case kept. Second half of the spawn key.",
    status: "assumed",
    ignored: false,
  },
  3: unused("classType", "Stored. No sim field."),
  4: unused("bpv", "Stored. No sim field."),
  5: unused("specialRole", "Stored. No sim field."),
  6: unused("yearFirstAvailable", "Stored. No sim field."),
  7: unused("yearLastAvailable", "Stored. No sim field."),
  8: unused("sizeClass", "Stored. No sim field."),
  9: {
    parser: "turnMode",
    consumer:
      "engine/sim/bind-shiplist.ts ShipSetup.turnMode → engine/sim/rules-tables.ts turnModeId and turnYawCap → engine/sim/hull.ts H.turnMode",
    transform:
      "×1 letter. Empty becomes H (stationary). AA and A–G use docs/rules/data/turn-modes.json fallbackMaxYawPerTick until measured.json turnYaw.measuredMaxYawPerTick has that letter. The harness records HET and mouse-helm rates in results-*.json; those rates are not copied into the turn table here.",
    status: "assumed",
    ignored: false,
  },
  10: {
    parser: "moveCost",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.moveCost100 → engine/sim/hull.ts H.moveCost100 → engine/sim/combat.ts movement budget",
    transform: "File decimal, at most two places, stored as hundredths (1 → 100, 0.75 → 75). Not a ×2.",
    status: "assumed",
    ignored: false,
  },
  11: unused("hetChance", "Header is HET +2 Turns & Nimble. Parsed. The loader does not read it."),
  12: unused("hetBreakdown", "Parsed. The loader does not read it."),
  13: {
    parser: "stealth",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.stealth → engine/sim/phase3.ts defensiveEcm → engine/sim/hull.ts H.stealth",
    transform:
      "CE header `Stealth (+ECM)`. A trailing `_`, extra spaces, or different case is the same column (the audit keys headers that way). ×1. May be negative. Added to paid ECM, then floored at 0.",
    status: "assumed",
    ignored: false,
  },
  14: {
    parser: "crew",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.crew → engine/sim/hull.ts H.crew",
    transform: "×1 whole crew.",
    status: "assumed",
    ignored: false,
  },
  15: unused("boardingPartiesBase", "Parsed. The loader does not read it."),
  16: unused("boardingPartiesMax", "Parsed. The loader does not read it."),
  17: unused("deckCrews", "Parsed. The loader does not read it."),
  18: {
    parser: "totalCrew",
    consumer: "tools/formats/shiplist.ts crewTotalMismatch only",
    transform: "Parser compares the cell to crew + boardingPartiesBase/2 + deckCrews/2. The sim does not read the cell.",
    status: "unused",
    ignored: true,
  },
  19: {
    parser: "minCrew",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.minCrew → engine/sim/hull.ts H.minCrew",
    transform: "×1. Crew below this disables the hull.",
    status: "assumed",
    ignored: false,
  },
  20: {
    parser: "shieldFront",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[0] → engine/sim/hull.ts H.shieldMax0",
    transform: `${SHIELD_CITE} Shield 1 is the front facing (index 0), 1:1, no ×2. ${ENGINE_SHIELD}`,
    status: "measured",
    ignored: false,
  },
  21: {
    parser: "shieldForwardSide",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[1] and shieldsMax[5] → engine/sim/hull.ts H.shieldMax0+1 and +5",
    transform: `${SHIELD_CITE} Shield 2 _ 6 is each front-side facing (indexes 1 and 5), 1:1, no ×2. ${ENGINE_SHIELD}`,
    status: "measured",
    ignored: false,
  },
  22: {
    parser: "shieldAftSide",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[2] and shieldsMax[4] → engine/sim/hull.ts H.shieldMax0+2 and +4",
    transform: `${SHIELD_CITE} Shield 3 _ 5 is each rear-side facing (indexes 2 and 4), 1:1, no ×2. ${ENGINE_SHIELD}`,
    status: "measured",
    ignored: false,
  },
  23: {
    parser: "shieldRear",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.shieldsMax[3] → engine/sim/hull.ts H.shieldMax0+3",
    transform: `${SHIELD_CITE} Shield 4 is the rear facing (index 3), 1:1, no ×2. ${ENGINE_SHIELD}`,
    status: "measured",
    ignored: false,
  },
  24: {
    parser: "shieldTotal",
    consumer: "tools/formats/shiplist.ts shieldTotalMismatch; tools/ship-audit shield-total check. Not read by engine/sim/bind-shiplist.ts",
    transform:
      `${SHIELD_CITE} Identity, file units, 1:1 per facing: Total = Shield 1 + 2×Shield 2 _ 6 + 2×Shield 3 _ 5 + Shield 4. The sim ignores the stored total and rebuilds the six facings 1:1, matching this sum.`,
    status: "measured",
    ignored: true,
  },
  25: {
    parser: "cloakCost",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.cloakCost → engine/sim/phase3.ts → engine/sim/hull.ts H.cloakCost",
    transform: "×1 energy per rules-turn. Empty or 0 means no cloak.",
    status: "assumed",
    ignored: false,
  },
  101: unused("probes", "Parsed. Not read in the duel slice."),
  102: unused("tBombsBase", "Parsed. Not read in the duel slice."),
  103: unused("tBombsMax", "Parsed. Not read in the duel slice."),
  104: unused("nuclearMinesBase", "Parsed. Not read in the duel slice."),
  105: unused("nuclearMinesMax", "Parsed. Not read in the duel slice."),
  106: unused("droneControl", "Parsed. Not read in the duel slice."),
  107: {
    parser: "add6",
    consumer: "none. docs/rules/shiplist-mapping.md records ship ADD_6 as not read by ship rules",
    transform: "Kept on the row. The EaW-lineage file ignores ADD_6 (docs/formats/shiplist.md S7). Not a weapon mount.",
    status: "unused",
    ignored: true,
  },
  108: {
    parser: "add12",
    consumer: "none. docs/rules/shiplist-mapping.md records ship ADD_12 as not read by ship rules",
    transform: "Kept on the row. The EaW-lineage file ignores ADD_12 (docs/formats/shiplist.md S7). Not a weapon mount.",
    status: "unused",
    ignored: true,
  },
  109: unused("shuttleBayCapacity", "Header is Shuttles Size. Parsed. Not read by the sim."),
  110: unused("launchRate", "Parsed. Not read by the sim."),
  111: unused("adminShuttlesBase", "Header is General Base. Parsed. Not read by the sim."),
  112: unused("adminShuttlesMax", "Header is General Max. Parsed. Not read by the sim."),
  113: unused("fighterBay0", "Header is Fighter Bay 1. Parsed. Not read by the sim."),
  114: unused("fighterType0", "Header is Fighter Type 1. Parsed. Not read by the sim."),
  115: unused("fighterBay1", "Header is Fighter Bay 2. Parsed. Not read by the sim."),
  116: unused("fighterType1", "Header is Fighter Type 2. Parsed. Not read by the sim."),
  117: unused("fighterBay2", "Header is Fighter Bay 3. Parsed. Not read by the sim."),
  118: unused("fighterType2", "Header is Fighter Type 3. Parsed. Not read by the sim."),
  119: unused("fighterBay3", "Header is Fighter Bay 4. Parsed. Not read by the sim."),
  120: unused("fighterType3", "Header is Fighter Type 4. Parsed. Not read by the sim."),
  121: {
    parser: "armor",
    consumer: "engine/sim/hull.ts H.armor exists, but engine/sim/bind-shiplist.ts does not copy this column (systems.armor stays unset, so the field stays 0)",
    transform: "×1 boxes in the file. The loader drops the cell. The audit still reports the file value next to the sim value.",
    status: "unused",
    ignored: true,
  },
  122: {
    parser: "hullForward",
    consumer: "engine/sim/hull.ts H.hullForward exists, but engine/sim/bind-shiplist.ts does not copy Forward Hull",
    transform: "×1 boxes. The loader drops the cell, so H.hullForward stays 0.",
    status: "unused",
    ignored: true,
  },
  123: {
    parser: "hullCenter",
    consumer: "engine/sim/hull.ts H.hullCenter exists, but engine/sim/bind-shiplist.ts does not copy Center Hull",
    transform: "×1 boxes. The loader drops the cell, so H.hullCenter stays 0.",
    status: "unused",
    ignored: true,
  },
  124: {
    parser: "hullAft",
    consumer: "engine/sim/hull.ts H.hullAft exists, but engine/sim/bind-shiplist.ts does not copy Aft Hull",
    transform: "×1 boxes. The loader drops the cell, so H.hullAft stays 0.",
    status: "unused",
    ignored: true,
  },
  125: unused("cargo", "Parsed. Not on ShipSetup."),
  126: unused("barracks", "Parsed. Not on ShipSetup."),
  127: unused("repair", "Parsed. Not on ShipSetup."),
  128: {
    parser: "warpSide",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.warp → engine/sim/hull.ts H.warp100",
    transform: "×2, then added to C_Warp. The file stores one side rating. The loader treats two engines. Unverified on CE 2.670.",
    status: "assumed",
    ignored: false,
  },
  129: {
    parser: "warpCenter",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.warp → engine/sim/hull.ts H.warp100",
    transform: "×1, added to the doubled side term. power.warp = 2×R_L_Warp + C_Warp.",
    status: "assumed",
    ignored: false,
  },
  130: {
    parser: "impulse",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.impulse → engine/sim/hull.ts H.impulse100",
    transform: "×1. Included in the generation sum warp + impulse + APR.",
    status: "assumed",
    ignored: false,
  },
  131: {
    parser: "apr",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.apr → engine/sim/hull.ts H.apr100",
    transform: "×1. Included in the generation sum.",
    status: "assumed",
    ignored: false,
  },
  132: {
    parser: "battery",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.battery and batteryCapacity → engine/sim/hull.ts H.battery100 and H.batteryCapacity100",
    transform: "×1. The same cell is the starting charge and the capacity (the hull starts full).",
    status: "assumed",
    ignored: false,
  },
  133: {
    parser: "bridge",
    consumer: "engine/sim/hull.ts H.bridge exists, but engine/sim/bind-shiplist.ts does not copy Bridge",
    transform: "×1 boxes. The loader drops the cell, so H.bridge stays 0.",
    status: "unused",
    ignored: true,
  },
  134: unused("security", "Parsed. Not on ShipSetup."),
  135: {
    parser: "lab",
    consumer: "none. engine/sim/phase3.ts EW cap reads sensors + scanners + specialSensors, not lab",
    transform: "Parsed. Not copied onto the hull.",
    status: "unused",
    ignored: true,
  },
  136: unused("transporters", "Parsed. Not on ShipSetup."),
  137: {
    parser: "tractors",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.tractors → engine/sim/phase3.ts → engine/sim/hull.ts H.tractors",
    transform: "×1 boxes. Zero means no tractor.",
    status: "assumed",
    ignored: false,
  },
  138: {
    parser: "mechTractors",
    consumer: "none. docs/rules/phase3-systems.md leaves mechTractors unread",
    transform: "Parsed and not read.",
    status: "unused",
    ignored: true,
  },
  139: {
    parser: "specialSensors",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.specialSensors → engine/sim/phase3.ts → engine/sim/hull.ts H.specialSensors",
    transform: "×1 boxes. Each box can spot a cloak the range check missed.",
    status: "assumed",
    ignored: false,
  },
  140: {
    parser: "sensors",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.systems.sensors → engine/sim/hull.ts H.sensors",
    transform: "×1 boxes. Part of the EW cap with scanners and special sensors.",
    status: "assumed",
    ignored: false,
  },
  141: {
    parser: "scanners",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.scanners → engine/sim/phase3.ts → engine/sim/hull.ts H.scanners",
    transform: "×1 boxes. Each box extends cloak detection.",
    status: "assumed",
    ignored: false,
  },
  142: unused("explosionStrength", "Parsed. Not on ShipSetup."),
  143: {
    parser: "acceleration",
    consumer: "engine/sim/bind-shiplist.ts ShipSetup.acceleration → engine/sim/hull.ts H.acceleration → engine/sim/combat.ts speed step",
    transform: "×1 speed per turn. Empty means the hull does not move (stored as -1).",
    status: "assumed",
    ignored: false,
  },
  144: unused("damageControl", "Parsed. Not on ShipSetup."),
  145: {
    parser: "extraDamage",
    consumer: "engine/sim/hull.ts H.extra exists, but engine/sim/bind-shiplist.ts does not copy Extra Damage",
    transform: "×1. The loader drops the cell, so H.extra stays 0.",
    status: "unused",
    ignored: true,
  },
  146: unused("cost", "Header is Ship Cost. Parsed. Not on ShipSetup."),
  147: {
    parser: "refitBaseClass",
    consumer: "tools/formats/shiplist.ts missingRefitBase only",
    transform: "String, case kept. The sim does not read it.",
    status: "unused",
    ignored: true,
  },
  148: {
    parser: "geometry",
    consumer: "engine/render/src/ship-catalog.ts LoadedShip.geometry",
    transform: "Install-relative path, slashes normalized. No scale.",
    status: "assumed",
    ignored: false,
  },
  149: unused("uiKey", "Header is UI. Parsed. No runtime reader yet."),
  150: unused("displayName", "Header is Full Name. Parsed. Values from an install are never committed."),
  151: raw("Spreadsheet column. Not a role and not a weapon slot."),
  152: raw("Spreadsheet column. Not a role."),
  153: raw("Spreadsheet column. Not a role."),
  154: raw("Blank header. Kept as a raw column. Not a role."),
  180: raw("Spreadsheet total. Not a weapon and not a sim field."),
  181: raw("Spreadsheet column FB1. Not Fighter Bay 1 and not a sim field."),
  182: raw("Spreadsheet column FB2. Not a sim field."),
  183: raw("Spreadsheet column FB3. Not a sim field."),
  184: raw("Spreadsheet column FB4. Not a sim field."),
  185: raw("Spreadsheet total. Not a sim field."),
  186: raw("Spreadsheet total. Not a sim field."),
  187: raw("Spreadsheet total. Not a sim field."),
  188: unused("sfbYearFirstAvailable", "Parsed. Not on ShipSetup."),
  189: unused("sfbYearLastAvailable", "Parsed. Not on ShipSetup."),
};

function annotate(index: number): Ann {
  if (index >= 26 && index <= 100) return weaponAnn(index);
  if (index >= 155 && index <= 179) {
    const n = index - 154;
    return raw(`W${n} is an extra spreadsheet column. It is not hardpoints[${n - 1}] and it is not mounted.`);
  }
  const row = STATIC[index];
  if (!row) throw new Error(`missing shiplist annotation ${index}`);
  return row;
}

/** Catalog key: case, spacing, and a trailing underscore do not make a second column. */
export function headerKey(name: string): string {
  return name.trim().toLowerCase().replace(/\u00a0/g, " ").replace(/_+$/g, "").replace(/\s+/g, "");
}

const KNOWN_HEADER_KEYS = new Set(CE_HEADERS.map((name) => headerKey(name)));

export function isKnownHeader(name: string): boolean {
  return KNOWN_HEADER_KEYS.has(headerKey(name));
}

export const FIELD_COLUMNS: readonly FieldColumn[] = CE_HEADERS.map((column, index) => {
  const ann = annotate(index);
  return {
    index,
    column,
    parserField: ann.parser,
    consumer: ann.consumer,
    transform: ann.transform,
    status: ann.status,
    ignored: ann.ignored,
  };
});

export function columnCounts(): { measured: number; assumed: number; unused: number; ignored: number } {
  let measured = 0;
  let assumed = 0;
  let unused = 0;
  let ignored = 0;
  for (const column of FIELD_COLUMNS) {
    if (column.status === "measured") measured += 1;
    else if (column.status === "assumed") assumed += 1;
    else unused += 1;
    if (column.ignored) ignored += 1;
  }
  return { measured, assumed, unused, ignored };
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function columnLabel(column: string): string {
  return column === "" ? "(empty)" : column;
}

/** Markdown body of docs/formats/shiplist-field-map.md. */
export function renderFieldMap(): string {
  const counts = columnCounts();
  const ignored = FIELD_COLUMNS.filter((column) => column.ignored);
  const lines: string[] = [
    "# Shiplist field map (CE 2.670)",
    "",
    "Baseline: Community Edition 2.670. Column names are the 190-header inventory in [shiplist-ftrlist-ce-2.670.md](inventory/shiplist-ftrlist-ce-2.670.md) (names only, no data rows). Parser roles are [shiplist.md](shiplist.md) and `tools/formats/tokens.ts`. The loader is `engine/sim/bind-shiplist.ts`. Scale factors live in [docs/rules/data/scale-factors.json](../rules/data/scale-factors.json) and [docs/rules/data/measured.json](../rules/data/measured.json).",
    "",
    "Clean-room. This map does not copy ship rows or install values. Real files are read only at runtime from `SFC2_INSTALL` by `pnpm ship-audit`. Capture files from `tools/ce-harness` stay on `sfc2-ci`.",
    "",
    "## Shield pairing and 1:1 scaling (measured)",
    "",
    "The shield pairing and 1:1 scale factor are measured (CE in-battle capture 2026-11-24; `Shield Total = S1 + 2·S2_6 + 2·S3_5 + S4` held on all 1,157 CE rows). Note: the CE Vessel Library screen is unreliable for shields (some rear values, e.g. on D7/POL/E4 rows, disagree with the table); the in-battle six-segment ring and the table agree.",
    "",
    "Measured rule, 1:1 per facing, no ×2:",
    "",
    "| File column | Facings (0 = front, clockwise) | Factor |",
    "| --- | --- | --- |",
    "| Shield 1 | 0 front | ×1 |",
    "| Shield 2 _ 6 | 1 and 5, each front-side facing | ×1 |",
    "| Shield 3 _ 5 | 2 and 4, each rear-side facing | ×1 |",
    "| Shield 4 | 3 rear | ×1 |",
    "",
    "File identity: `Shield Total = Shield 1 + 2×Shield 2 _ 6 + 2×Shield 3 _ 5 + Shield 4`. The two side columns are counted twice because each one is two facings, not because of a scale factor.",
    "",
    "The engine now matches that measurement: `docs/rules/data/measured.json` sets `sideColumnFactor: 1`, `endFactor: 1`, and the 4-to-6 pairing, so `shieldMaxFromCells` maps a file row 10, 8, 6, 4 to engine shields `[10, 8, 6, 4, 6, 8]`. The stored Shield Total is ignored by the loader, which rebuilds the six facings.",
    "",
    "`pnpm ship-audit` checks the file identity above. It also counts hulls whose engine facings differ from the 1:1 reading (`shieldScale.engineNotOneToOne`). That count is a column stat. It is not a failed identity check, and it does not by itself fail the run.",
    "",
    "## Status and the ignored flag",
    "",
    "| Status | Meaning |",
    "| --- | --- |",
    "| measured | A harness capture on CE 2.670 fixed the reading. The citation is in the transform cell. |",
    "| assumed | The loader reads the column with the transform shown. Playtest has not replaced it. |",
    "| unused | No sim or rules reader. The parser may still store the cell or check it. |",
    "",
    "Ignored `yes` means current sim and rules code does not read the column. There are " +
      `${counts.ignored} ignored columns, ${counts.measured} measured, ${counts.assumed} assumed, and ${counts.unused} unused. ` +
      "There is no speed column. Spawn speed is 0. Cruise speed in the audit is the whole generation spent on movement: `(warp + impulse + APR) × 100 / moveCost100`, integer division, and 0 when the hull cannot move.",
    "",
    "## Every column",
    "",
    "| # | Column | Parser field | Sim / rules consumer | Transform | Status | Ignored |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const column of FIELD_COLUMNS) {
    lines.push(
      `| ${column.index} | ${cell(columnLabel(column.column))} | ${cell(column.parserField)} | ${cell(column.consumer)} | ${cell(column.transform)} | ${column.status} | ${column.ignored ? "yes" : "no"} |`,
    );
  }
  lines.push("");
  lines.push("## Ignored columns");
  lines.push("");
  lines.push("Every column flagged ignored, by index:");
  lines.push("");
  for (const column of ignored) {
    lines.push(`- ${column.index} ${columnLabel(column.column)}`);
  }
  lines.push("");
  return lines.join("\n");
}
