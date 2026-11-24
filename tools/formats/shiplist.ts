/**
 * parseShiplist — docs/formats/shiplist.md.
 *
 * Values stay in file units. All 25 hardpoint slots are emitted, including
 * empty ones. Reload-counted racks (DroA/B/C/F/G, ADD6, ADD12) store an Arc
 * cell of 1, 2 or 3 on `reloads` and have no firing arc. DroI and DroVI keep
 * a letter arc. Vocabulary diagnostics use source `loader`.
 */

import {
  makeDiagnostic,
  type Diagnostic,
  type ParseOptions,
  type ParseResult,
} from "./diagnostics.ts";
import {
  isKnownHull,
  isKnownRace,
  isKnownTurn,
  isPlayableHull,
  SHIP_NUMBER_ALIASES,
  SHIP_STRING_ALIASES,
  isArcHeader,
  isCountHeader,
  shipWeaponSlot,
} from "./tokens.ts";
import {
  decodeSpecText,
  normHeader,
  normalizeInstallPath,
  parseNumberCell,
  splitHeader,
  tableLines,
  type TextLine,
} from "./text.ts";
import { interpretWeaponArc } from "./weapons.ts";

export interface HardpointSlot {
  /** 0..24, file order. File slot 1 is slotIndex 0. */
  slotIndex: number;
  /** As written. Null when the cell is empty. */
  count: number | null;
  /** Exact file spelling, never renamed. Null when the cell is empty. */
  weapon: string | null;
  /** Exact file spelling. Null when the cell is empty or holds a reload count. */
  arc: string | null;
  /** Reload-counted racks only. Null when the Arc cell is not 1, 2 or 3. */
  reloads: number | null;
}

export interface ShiplistRow {
  /** 1-based source line. */
  line: number;
  /** `${race}:${className}`, case kept. See docs/formats/shiplist.md §4.11. */
  spawnKey: string;
  /** Keyed by the raw header, or `col0`… when there is no header. */
  fields: Record<string, string | number>;
  /** Always 25 entries. */
  hardpoints: HardpointSlot[];
  /** Original cells, including a tolerated trailing tab. */
  raw: string[];
  /** Cells past the header. Trailing empty tabs are not stored here. */
  extra: Record<string, string | number>;
}

export interface Shiplist {
  headerRows: string[][];
  columns: string[];
  rows: ShiplistRow[];
}

type Role =
  | { kind: "string"; id: string }
  | { kind: "number"; id: string }
  | { kind: "hpCount"; slot: number }
  | { kind: "hpWeapon"; slot: number }
  | { kind: "hpArc"; slot: number }
  | { kind: "raw" };

interface PlannedColumn {
  index: number;
  rawName: string;
  role: Role;
}

interface BuiltRow {
  row: ShiplistRow;
  race: string;
  className: string;
  refit: string;
  refitPresent: boolean;
  refitColumn?: number;
  refitField?: string;
}

const STRING_AT: Record<number, string> = {
  0: "race",
  1: "hullType",
  2: "className",
  4: "specialRole",
  8: "turnMode",
  149: "refitBaseClass",
  151: "geometry",
  152: "uiKey",
};

const NUMBER_AT: Record<number, string> = {
  3: "bpv",
  5: "yearFirstAvailable",
  6: "yearLastAvailable",
  7: "sizeClass",
  9: "moveCost",
  10: "hetChance",
  11: "hetBreakdown",
  12: "stealth",
  13: "crew",
  14: "boardingPartiesBase",
  15: "boardingPartiesMax",
  16: "deckCrews",
  17: "totalCrew",
  18: "minCrew",
  19: "shieldFront",
  20: "shieldForwardSide",
  21: "shieldAftSide",
  22: "shieldRear",
  23: "shieldTotal",
  24: "cloakCost",
  100: "probes",
  101: "tBombsBase",
  102: "tBombsMax",
  103: "nuclearMinesBase",
  104: "nuclearMinesMax",
  105: "droneControl",
  106: "add6",
  107: "add12",
  108: "shuttleBayCapacity",
  109: "launchRate",
  110: "adminShuttlesBase",
  111: "adminShuttlesMax",
  112: "suicideShuttlesBase",
  113: "suicideShuttlesMax",
  114: "scatterPacksBase",
  115: "scatterPacksMax",
  116: "wildWeaselsBase",
  117: "wildWeaselsMax",
  118: "replacementShuttles",
  119: "fighterBay0",
  120: "fighterBay1",
  121: "fighterBay2",
  122: "fighterBay3",
  123: "armor",
  124: "hullForward",
  125: "hullCenter",
  126: "hullAft",
  127: "cargo",
  128: "barracks",
  129: "repair",
  130: "warpSide",
  131: "warpCenter",
  132: "impulse",
  133: "apr",
  134: "battery",
  135: "bridge",
  136: "security",
  137: "lab",
  138: "transporters",
  139: "tractors",
  140: "mechTractors",
  141: "specialSensors",
  142: "sensors",
  143: "scanners",
  144: "explosionStrength",
  145: "acceleration",
  146: "damageControl",
  147: "extraDamage",
  148: "cost",
  150: "refitCost",
};

function shipIndexRole(index: number): Role {
  const stringId = STRING_AT[index];
  if (stringId) return { kind: "string", id: stringId };
  const numberId = NUMBER_AT[index];
  if (numberId) return { kind: "number", id: numberId };
  if (index >= 25 && index <= 99) {
    const offset = index - 25;
    const slot = Math.floor(offset / 3);
    const part = offset % 3;
    if (part === 0) return { kind: "hpCount", slot };
    if (part === 1) return { kind: "hpWeapon", slot };
    return { kind: "hpArc", slot };
  }
  return { kind: "raw" };
}

function claim(
  roles: Role[],
  headers: string[],
  index: number,
  test: (norm: string) => boolean,
  role: Role,
): void {
  if (index < 0 || index >= roles.length) return;
  if (roles[index].kind !== "raw") return;
  if (!test(normHeader(headers[index] ?? ""))) return;
  roles[index] = role;
}

function planShipHeaders(headers: string[]): PlannedColumn[] {
  const roles: Role[] = headers.map(() => ({ kind: "raw" }));
  const weaponCols: number[] = [];
  headers.forEach((header, index) => {
    const slot = shipWeaponSlot(normHeader(header));
    if (slot == null) return;
    roles[index] = { kind: "hpWeapon", slot };
    weaponCols.push(index);
  });
  for (const index of weaponCols) {
    const role = roles[index];
    if (role.kind !== "hpWeapon") continue;
    claim(roles, headers, index - 1, isCountHeader, { kind: "hpCount", slot: role.slot });
    claim(roles, headers, index + 1, isArcHeader, { kind: "hpArc", slot: role.slot });
  }
  headers.forEach((header, index) => {
    if (roles[index].kind !== "raw") return;
    const norm = normHeader(header);
    const stringId = SHIP_STRING_ALIASES[norm];
    if (stringId) {
      roles[index] = { kind: "string", id: stringId };
      return;
    }
    const numberId = SHIP_NUMBER_ALIASES[norm];
    if (numberId) roles[index] = { kind: "number", id: numberId };
  });
  return headers.map((rawName, index) => ({ index, rawName, role: roles[index] }));
}

function planShipIndex(width: number): PlannedColumn[] {
  const planned: PlannedColumn[] = [];
  for (let index = 0; index < width; index++) {
    planned.push({ index, rawName: `col${index}`, role: shipIndexRole(index) });
  }
  return planned;
}

function emptyHardpoints(): HardpointSlot[] {
  return Array.from({ length: 25 }, (_, slotIndex) => ({
    slotIndex,
    count: null,
    weapon: null,
    arc: null,
    reloads: null,
  }));
}

function emptyShiplist(): Shiplist {
  return { headerRows: [], columns: [], rows: [] };
}

function readOptions(options: ParseOptions | undefined): { file?: string; checkVocabulary: boolean } {
  if (options == null) return { checkVocabulary: true };
  if (typeof options !== "object") throw new TypeError("parse options must be an object");
  const file = options.file;
  if (file != null && typeof file !== "string") throw new TypeError("parse options.file must be a string");
  return {
    file: file == null || file === "" ? undefined : normalizeInstallPath(file),
    checkVocabulary: options.checkVocabulary !== false,
  };
}

function cellAt(cells: string[], index: number): string {
  return index < cells.length ? cells[index] : "";
}

function putField(
  fields: Record<string, string | number>,
  extra: Record<string, string | number>,
  rawName: string,
  index: number,
  value: string | number,
): void {
  if (!Object.prototype.hasOwnProperty.call(fields, rawName)) {
    fields[rawName] = value;
    return;
  }
  extra[`col${index}`] = value;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-6;
}

interface SlotScratch {
  arcRaw: string | null;
  arcSeen: boolean;
  weaponColumn?: number;
  weaponField?: string;
  arcColumn?: number;
  arcField?: string;
  countColumn?: number;
  countField?: string;
}

function blankSlotScratch(): SlotScratch[] {
  return Array.from({ length: 25 }, () => ({ arcRaw: null, arcSeen: false }));
}

/**
 * Parse a shiplist table. Never throws on malformed text.
 * `location.file`, when present, is the install-relative path with forward slashes.
 * `emptyFile` and `noHeader` omit `location`.
 */
export function parseShiplist(
  input: ArrayBuffer | Uint8Array | string,
  options?: ParseOptions,
): ParseResult<Shiplist> {
  const { file, checkVocabulary } = readOptions(options);
  const text = decodeSpecText(input);
  const lines = tableLines(text);
  if (lines.length === 0) {
    return {
      data: emptyShiplist(),
      diagnostics: [makeDiagnostic("emptyFile", "shiplist", "error", file, undefined)],
    };
  }

  const split = splitHeader(lines);
  const diagnostics: Diagnostic[] = [];
  if (!split.columns) {
    diagnostics.push(makeDiagnostic("noHeader", "shiplist", "warning", file, undefined));
  } else if (split.multipleHeaderLine != null) {
    diagnostics.push(
      makeDiagnostic(
        "multipleHeaderRows",
        "shiplist",
        "info",
        file,
        { line: split.multipleHeaderLine },
        { count: split.headerRows.length },
      ),
    );
  }

  const headerPlan = split.columns ? planShipHeaders(split.columns) : null;
  const builtRows: BuiltRow[] = [];
  for (const line of split.data) {
    builtRows.push(buildRow(line, headerPlan, file, checkVocabulary, diagnostics));
  }

  const classNames = new Set<string>();
  for (const built of builtRows) {
    if (built.className !== "") classNames.add(built.className.toLowerCase());
  }
  for (const built of builtRows) {
    if (!built.refitPresent || built.refit === "") continue;
    if (classNames.has(built.refit.toLowerCase())) continue;
    diagnostics.push(
      makeDiagnostic(
        "missingRefitBase",
        "shiplist",
        "warning",
        file,
        { line: built.row.line, column: built.refitColumn, field: built.refitField },
        { refitBaseClass: built.refit },
      ),
    );
  }

  emitDuplicates(builtRows, file, diagnostics);

  return {
    data: {
      headerRows: split.headerRows,
      columns: split.columns ?? [],
      rows: builtRows.map((built) => built.row),
    },
    diagnostics,
  };
}

function buildRow(
  line: TextLine,
  headerPlan: PlannedColumn[] | null,
  file: string | undefined,
  checkVocabulary: boolean,
  diagnostics: Diagnostic[],
): BuiltRow {
  const cells = line.cells;
  const plan = headerPlan ?? planShipIndex(cells.length);
  const fields: Record<string, string | number> = {};
  const extra: Record<string, string | number> = {};
  const byId: Record<string, string | number> = {};
  const present = new Set<string>();
  const roleAt: Record<string, { column: number; field: string }> = {};
  const hardpoints = emptyHardpoints();
  const scratch = blankSlotScratch();
  const countSeen = Array<boolean>(25).fill(false);
  const weaponSeen = Array<boolean>(25).fill(false);

  if (headerPlan) {
    if (cells.length < headerPlan.length) {
      diagnostics.push(
        makeDiagnostic(
          "raggedRow",
          "shiplist",
          "warning",
          file,
          { line: line.line },
          { expected: headerPlan.length, actual: cells.length },
        ),
      );
    } else if (cells.length > headerPlan.length && extrasHaveText(cells, headerPlan.length)) {
      diagnostics.push(
        makeDiagnostic(
          "raggedRow",
          "shiplist",
          "warning",
          file,
          { line: line.line },
          { expected: headerPlan.length, actual: cells.length },
        ),
      );
      for (let index = headerPlan.length; index < cells.length; index++) {
        const parsed = parseNumberCell(cells[index]);
        extra[`col${index}`] = parsed.kind === "ok" ? parsed.value : cells[index];
      }
    }
  }

  for (const column of plan) {
    const rawCell = cellAt(cells, column.index);
    const columnNumber = column.index + 1;
    if (column.role.kind === "string") {
      const value = rawCell.trim();
      remember(present, byId, roleAt, column.role.id, value, columnNumber, column.rawName);
      putField(fields, extra, column.rawName, column.index, value);
    } else if (column.role.kind === "number") {
      const parsed = parseNumberCell(rawCell);
      let value = 0;
      if (parsed.kind === "bad") {
        diagnostics.push(
          makeDiagnostic(
            "badNumber",
            "shiplist",
            "warning",
            file,
            { line: line.line, column: columnNumber, field: column.rawName },
            { raw: rawCell },
          ),
        );
      } else if (parsed.kind === "ok") {
        value = parsed.value;
      }
      remember(present, byId, roleAt, column.role.id, value, columnNumber, column.rawName);
      putField(fields, extra, column.rawName, column.index, value);
    } else if (column.role.kind === "hpCount") {
      const slot = column.role.slot;
      if (!countSeen[slot]) {
        countSeen[slot] = true;
        scratch[slot].countColumn = columnNumber;
        scratch[slot].countField = column.rawName;
        const parsed = parseNumberCell(rawCell);
        if (parsed.kind === "bad") {
          hardpoints[slot].count = 0;
          diagnostics.push(
            makeDiagnostic(
              "badNumber",
              "shiplist",
              "warning",
              file,
              { line: line.line, column: columnNumber, field: column.rawName },
              { raw: rawCell },
            ),
          );
        } else if (parsed.kind === "ok") {
          hardpoints[slot].count = parsed.value;
        }
      }
    } else if (column.role.kind === "hpWeapon") {
      const slot = column.role.slot;
      if (!weaponSeen[slot]) {
        weaponSeen[slot] = true;
        const value = rawCell.trim();
        hardpoints[slot].weapon = value === "" ? null : value;
        scratch[slot].weaponColumn = columnNumber;
        scratch[slot].weaponField = column.rawName;
      }
    } else if (column.role.kind === "hpArc") {
      const slot = column.role.slot;
      if (!scratch[slot].arcSeen) {
        scratch[slot].arcSeen = true;
        const value = rawCell.trim();
        scratch[slot].arcRaw = value === "" ? null : value;
        scratch[slot].arcColumn = columnNumber;
        scratch[slot].arcField = column.rawName;
      }
    } else {
      const parsed = parseNumberCell(rawCell);
      putField(fields, extra, column.rawName, column.index, parsed.kind === "ok" ? parsed.value : rawCell.trim());
    }
  }

  const race = textRole(byId, "race");
  const className = textRole(byId, "className");
  const spawnKey = `${race}:${className}`;

  for (let slotIndex = 0; slotIndex < 25; slotIndex++) {
    const slot = hardpoints[slotIndex];
    const meta = scratch[slotIndex];
    if (slot.weapon == null) {
      slot.arc = meta.arcRaw;
    } else {
      const interpreted = interpretWeaponArc(slot.weapon, meta.arcRaw);
      slot.arc = interpreted.arc;
      slot.reloads = interpreted.reloads;
      if (checkVocabulary && interpreted.unknownWeapon) {
        diagnostics.push(
          makeDiagnostic(
            "unknownWeapon",
            "loader",
            "warning",
            file,
            { line: line.line, column: meta.weaponColumn, field: meta.weaponField },
            { spawnKey, slotIndex, code: slot.weapon },
          ),
        );
      }
      if (checkVocabulary && interpreted.unknownArc) {
        diagnostics.push(
          makeDiagnostic(
            "unknownArc",
            "loader",
            "warning",
            file,
            {
              line: line.line,
              column: meta.arcColumn ?? meta.weaponColumn,
              field: meta.arcField ?? meta.weaponField,
            },
            { spawnKey, slotIndex, code: interpreted.arcCode },
          ),
        );
      }
    }
    if (!countOutOfRange(slot) && !countWithoutWeapon(slot) && !weaponWithoutCount(slot)) continue;
    const pointAtWeapon = weaponWithoutCount(slot) && !countOutOfRange(slot);
    diagnostics.push(
      makeDiagnostic(
        "hardpointCountRange",
        "shiplist",
        "warning",
        file,
        {
          line: line.line,
          column: pointAtWeapon ? meta.weaponColumn : meta.countColumn ?? meta.weaponColumn,
          field: pointAtWeapon ? meta.weaponField : meta.countField ?? meta.weaponField,
        },
        { slotIndex, count: slot.count, weapon: slot.weapon },
      ),
    );
  }

  if (present.has("race")) {
    const value = textRole(byId, "race");
    if (value !== "" && !isKnownRace(value)) {
      const at = roleAt.race;
      diagnostics.push(
        makeDiagnostic(
          "unknownRace",
          "shiplist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { value },
        ),
      );
    }
  }
  if (present.has("hullType")) {
    const value = textRole(byId, "hullType");
    if (value !== "" && !isKnownHull(value)) {
      const at = roleAt.hullType;
      diagnostics.push(
        makeDiagnostic(
          "unknownHullType",
          "shiplist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { value },
        ),
      );
    }
  }
  if (present.has("turnMode")) {
    const value = textRole(byId, "turnMode");
    if (value !== "" && !isKnownTurn(value)) {
      const at = roleAt.turnMode;
      diagnostics.push(
        makeDiagnostic(
          "unknownTurnMode",
          "shiplist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { value },
        ),
      );
    }
  }

  if (present.has("yearFirstAvailable") && present.has("yearLastAvailable")) {
    const first = numberRole(byId, "yearFirstAvailable");
    const last = numberRole(byId, "yearLastAvailable");
    if (first > last) {
      const at = roleAt.yearFirstAvailable;
      diagnostics.push(
        makeDiagnostic(
          "yearOrder",
          "shiplist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { first, last },
        ),
      );
    }
  }

  if (
    present.has("shieldFront") &&
    present.has("shieldForwardSide") &&
    present.has("shieldAftSide") &&
    present.has("shieldRear") &&
    present.has("shieldTotal")
  ) {
    const front = numberRole(byId, "shieldFront");
    const forward = numberRole(byId, "shieldForwardSide");
    const aft = numberRole(byId, "shieldAftSide");
    const rear = numberRole(byId, "shieldRear");
    const actual = numberRole(byId, "shieldTotal");
    const expected = front + 2 * forward + 2 * aft + rear;
    if (!nearlyEqual(expected, actual)) {
      const at = roleAt.shieldTotal;
      diagnostics.push(
        makeDiagnostic(
          "shieldTotalMismatch",
          "shiplist",
          "info",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { expected, actual },
        ),
      );
    }
  }

  if (
    present.has("crew") &&
    present.has("boardingPartiesBase") &&
    present.has("deckCrews") &&
    present.has("totalCrew")
  ) {
    const crew = numberRole(byId, "crew");
    const parties = numberRole(byId, "boardingPartiesBase");
    const deck = numberRole(byId, "deckCrews");
    const actual = numberRole(byId, "totalCrew");
    const expected = crew + parties / 2 + deck / 2;
    if (!nearlyEqual(expected, actual)) {
      const at = roleAt.totalCrew;
      diagnostics.push(
        makeDiagnostic(
          "crewTotalMismatch",
          "shiplist",
          "info",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { expected, actual },
        ),
      );
    }
  }

  if (present.has("hullType") && present.has("geometry")) {
    const hullType = textRole(byId, "hullType");
    const geometry = textRole(byId, "geometry");
    if (hullType !== "" && isPlayableHull(hullType) && geometry === "") {
      const at = roleAt.geometry;
      diagnostics.push(
        makeDiagnostic(
          "missingGeometry",
          "shiplist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { hullType, className, spawnKey },
        ),
      );
    }
  }

  return {
    row: { line: line.line, spawnKey, fields, hardpoints, raw: cells.slice(), extra },
    race,
    className,
    refit: textRole(byId, "refitBaseClass"),
    refitPresent: present.has("refitBaseClass"),
    refitColumn: roleAt.refitBaseClass?.column,
    refitField: roleAt.refitBaseClass?.field,
  };
}

function remember(
  present: Set<string>,
  byId: Record<string, string | number>,
  roleAt: Record<string, { column: number; field: string }>,
  id: string,
  value: string | number,
  column: number,
  field: string,
): void {
  if (present.has(id)) return;
  present.add(id);
  byId[id] = value;
  roleAt[id] = { column, field };
}

function textRole(byId: Record<string, string | number>, id: string): string {
  const value = byId[id];
  return typeof value === "string" ? value : "";
}

function numberRole(byId: Record<string, string | number>, id: string): number {
  const value = byId[id];
  return typeof value === "number" ? value : 0;
}

function extrasHaveText(cells: string[], from: number): boolean {
  for (let index = from; index < cells.length; index++) {
    if (cells[index].trim() !== "") return true;
  }
  return false;
}

function countOutOfRange(slot: HardpointSlot): boolean {
  if (slot.count == null) return false;
  return !Number.isInteger(slot.count) || slot.count < 0 || slot.count > 4;
}

function countWithoutWeapon(slot: HardpointSlot): boolean {
  return slot.count != null && slot.count !== 0 && (slot.weapon == null || slot.weapon === "");
}

function weaponWithoutCount(slot: HardpointSlot): boolean {
  return slot.weapon != null && slot.weapon !== "" && (slot.count == null || slot.count === 0);
}

function emitDuplicates(builtRows: BuiltRow[], file: string | undefined, diagnostics: Diagnostic[]): void {
  const byKey = new Map<string, { race: string; className: string; rows: number[] }>();
  const byClass = new Map<string, { className: string; races: string[]; raceKeys: Set<string>; rows: number[] }>();
  for (const built of builtRows) {
    const key = `${built.race}:${built.className}`.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.rows.push(built.row.line);
    else byKey.set(key, { race: built.race, className: built.className, rows: [built.row.line] });

    const classKey = built.className.toLowerCase();
    const classGroup = byClass.get(classKey);
    const raceKey = built.race.toLowerCase();
    if (classGroup) {
      classGroup.rows.push(built.row.line);
      if (!classGroup.raceKeys.has(raceKey)) {
        classGroup.raceKeys.add(raceKey);
        classGroup.races.push(built.race);
      }
    } else {
      byClass.set(classKey, {
        className: built.className,
        races: [built.race],
        raceKeys: new Set([raceKey]),
        rows: [built.row.line],
      });
    }
  }

  for (const group of byKey.values()) {
    if (group.rows.length < 2) continue;
    diagnostics.push(
      makeDiagnostic(
        "duplicateClassKey",
        "shiplist",
        "error",
        file,
        { line: group.rows[group.rows.length - 1] },
        { race: group.race, className: group.className, rows: group.rows },
      ),
    );
  }
  for (const group of byClass.values()) {
    if (group.raceKeys.size < 2) continue;
    diagnostics.push(
      makeDiagnostic(
        "duplicateClassName",
        "shiplist",
        "warning",
        file,
        { line: group.rows[group.rows.length - 1] },
        { className: group.className, races: group.races, rows: group.rows },
      ),
    );
  }
}
