/**
 * parseFtrlist — docs/formats/ftrlist.md.
 *
 * Same table rules as the shiplist parser. There is no index fallback: without
 * a header, cells stay raw under `extra` as `col0`…. Weapon groups are emitted
 * only when Weapon1–Weapon5 headers are present. `Shots` is `load`. A
 * reload-counted Arc cell of 1, 2 or 3 is `reload` and clears the firing arc.
 * DroI and DroVI keep ALL.
 */

import {
  makeDiagnostic,
  type Diagnostic,
  type ParseOptions,
  type ParseResult,
} from "./diagnostics.ts";
import {
  FTR_NUMBER_ALIASES,
  FTR_STRING_ALIASES,
  fighterWeaponSlot,
  isArcHeader,
  isCountHeader,
  isKnownRace,
  isShotsHeader,
} from "./tokens.ts";
import {
  assignOwn,
  decodeSpecText,
  normHeader,
  parseNumberCell,
  specLocationFile,
  splitHeader,
  tableLines,
  type TextLine,
} from "./text.ts";
import { interpretWeaponArc } from "./weapons.ts";

export interface FighterWeapon {
  /** 0..4 for Weapon1..Weapon5. */
  slotIndex: number;
  /**
   * Num cell. Null when the cell is empty.
   * The format sketch omitted this; the rules mapping binds Num to the mount.
   */
  count: number | null;
  weapon: string | null;
  arc: string | null;
  /** Shots column. Null when the cell is empty. */
  load: number | null;
  /** Reload-counted Arc cell only. Otherwise null (Shots is not reload). */
  reload: number | null;
}

export interface FtrlistRow {
  line: number;
  fields: Record<string, string | number>;
  weapons: FighterWeapon[];
  raw: string[];
  extra: Record<string, string | number>;
}

export interface Ftrlist {
  headerRows: string[][];
  columns: string[];
  rows: FtrlistRow[];
}

export interface FtrlistParseOptions extends ParseOptions {
  /**
   * Shiplist class names for the importer-level `missingShipRef` check.
   * Omit to skip the cross-file check.
   */
  shipClassNames?: readonly string[];
}

type Role =
  | { kind: "string"; id: string }
  | { kind: "number"; id: string }
  | { kind: "hpCount"; slot: number }
  | { kind: "hpWeapon"; slot: number }
  | { kind: "hpArc"; slot: number }
  | { kind: "ftLoad"; slot: number }
  | { kind: "raw" };

interface PlannedColumn {
  index: number;
  rawName: string;
  role: Role;
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

function planFighterHeaders(headers: string[]): PlannedColumn[] {
  const roles: Role[] = headers.map(() => ({ kind: "raw" }));
  const weaponCols: number[] = [];
  headers.forEach((header, index) => {
    const slot = fighterWeaponSlot(normHeader(header));
    if (slot == null) return;
    roles[index] = { kind: "hpWeapon", slot };
    weaponCols.push(index);
  });
  for (const index of weaponCols) {
    const role = roles[index];
    if (role.kind !== "hpWeapon") continue;
    claim(roles, headers, index - 1, isCountHeader, { kind: "hpCount", slot: role.slot });
    claim(roles, headers, index + 1, isArcHeader, { kind: "hpArc", slot: role.slot });
    claim(roles, headers, index + 2, isShotsHeader, { kind: "ftLoad", slot: role.slot });
  }
  headers.forEach((header, index) => {
    if (roles[index].kind !== "raw") return;
    const norm = normHeader(header);
    const stringId = FTR_STRING_ALIASES[norm];
    if (stringId) {
      roles[index] = { kind: "string", id: stringId };
      return;
    }
    const numberId = FTR_NUMBER_ALIASES[norm];
    if (numberId) roles[index] = { kind: "number", id: numberId };
  });
  return headers.map((rawName, index) => ({ index, rawName, role: roles[index] }));
}

function readOptions(options: FtrlistParseOptions | undefined): {
  file?: string;
  checkVocabulary: boolean;
  shipClassNames?: ReadonlySet<string>;
} {
  if (options == null) return { checkVocabulary: true };
  if (typeof options !== "object") throw new TypeError("parse options must be an object");
  const file = options.file;
  if (file != null && typeof file !== "string") throw new TypeError("parse options.file must be a string");
  const names = options.shipClassNames;
  return {
    file: specLocationFile(file),
    checkVocabulary: options.checkVocabulary !== false,
    shipClassNames: names ? new Set(names.map((name) => name.toLowerCase())) : undefined,
  };
}

function emptyFtrlist(): Ftrlist {
  return { headerRows: [], columns: [], rows: [] };
}

/**
 * Parse a ftrlist table. Never throws on malformed text.
 * `noHeader` is an error: no column order is documented, so there is no index fallback.
 */
export function parseFtrlist(
  input: ArrayBuffer | Uint8Array | string,
  options?: FtrlistParseOptions,
): ParseResult<Ftrlist> {
  const { file, checkVocabulary, shipClassNames } = readOptions(options);
  const text = decodeSpecText(input);
  const lines = tableLines(text);
  if (lines.length === 0) {
    return {
      data: emptyFtrlist(),
      diagnostics: [makeDiagnostic("emptyFile", "ftrlist", "error", file, undefined)],
    };
  }

  const split = splitHeader(lines);
  const diagnostics: Diagnostic[] = [];
  if (!split.columns) {
    diagnostics.push(makeDiagnostic("noHeader", "ftrlist", "error", file, undefined));
  } else if (split.multipleHeaderLine != null) {
    diagnostics.push(
      makeDiagnostic(
        "multipleHeaderRows",
        "ftrlist",
        "info",
        file,
        { line: split.multipleHeaderLine },
        { count: split.headerRows.length },
      ),
    );
  }

  const plan = split.columns ? planFighterHeaders(split.columns) : null;
  const rows: FtrlistRow[] = [];
  const identities: Array<{ line: number; race: string; typeName: string }> = [];

  for (const line of split.data) {
    if (!plan) {
      const extra: Record<string, string | number> = {};
      line.cells.forEach((cell, index) => {
        extra[`col${index}`] = cell;
      });
      rows.push({ line: line.line, fields: {}, weapons: [], raw: line.cells.slice(), extra });
      continue;
    }
    const built = buildRow(line, plan, file, checkVocabulary, shipClassNames, diagnostics);
    rows.push(built.row);
    identities.push({ line: line.line, race: built.race, typeName: built.typeName });
  }

  emitDuplicateTypes(identities, file, diagnostics);

  return {
    data: { headerRows: split.headerRows, columns: split.columns ?? [], rows },
    diagnostics,
  };
}

interface SlotScratch {
  count: number | null;
  weapon: string | null;
  arcRaw: string | null;
  load: number | null;
  countSeen: boolean;
  weaponSeen: boolean;
  arcSeen: boolean;
  loadSeen: boolean;
  weaponColumn?: number;
  weaponField?: string;
  arcColumn?: number;
  arcField?: string;
}

function emptyScratch(): SlotScratch {
  return {
    count: null,
    weapon: null,
    arcRaw: null,
    load: null,
    countSeen: false,
    weaponSeen: false,
    arcSeen: false,
    loadSeen: false,
  };
}

function buildRow(
  line: TextLine,
  plan: PlannedColumn[],
  file: string | undefined,
  checkVocabulary: boolean,
  shipClassNames: ReadonlySet<string> | undefined,
  diagnostics: Diagnostic[],
): { row: FtrlistRow; race: string; typeName: string } {
  const cells = line.cells;
  const fields: Record<string, string | number> = {};
  const extra: Record<string, string | number> = {};
  const byId: Record<string, string | number> = {};
  const present = new Set<string>();
  const roleAt: Record<string, { column: number; field: string }> = {};
  const found = new Map<number, SlotScratch>();

  if (cells.length < plan.length) {
    diagnostics.push(
      makeDiagnostic(
        "raggedRow",
        "ftrlist",
        "warning",
        file,
        { line: line.line },
        { expected: plan.length, actual: cells.length },
      ),
    );
  } else if (cells.length > plan.length && extrasHaveText(cells, plan.length)) {
    diagnostics.push(
      makeDiagnostic(
        "raggedRow",
        "ftrlist",
        "warning",
        file,
        { line: line.line },
        { expected: plan.length, actual: cells.length },
      ),
    );
    for (let index = plan.length; index < cells.length; index++) {
      const parsed = parseNumberCell(cells[index]);
      extra[`col${index}`] = parsed.kind === "ok" ? parsed.value : cells[index];
    }
  }

  const ensure = (slot: number): SlotScratch => {
    let scratch = found.get(slot);
    if (!scratch) {
      scratch = emptyScratch();
      found.set(slot, scratch);
    }
    return scratch;
  };

  for (const column of plan) {
    const rawCell = column.index < cells.length ? cells[column.index] : "";
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
            "ftrlist",
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
      const scratch = ensure(column.role.slot);
      if (!scratch.countSeen) {
        scratch.countSeen = true;
        const parsed = parseNumberCell(rawCell);
        if (parsed.kind === "bad") {
          scratch.count = 0;
          diagnostics.push(
            makeDiagnostic(
              "badNumber",
              "ftrlist",
              "warning",
              file,
              { line: line.line, column: columnNumber, field: column.rawName },
              { raw: rawCell },
            ),
          );
        } else if (parsed.kind === "ok") {
          scratch.count = parsed.value;
        }
      }
    } else if (column.role.kind === "hpWeapon") {
      const scratch = ensure(column.role.slot);
      if (!scratch.weaponSeen) {
        scratch.weaponSeen = true;
        const value = rawCell.trim();
        scratch.weapon = value === "" ? null : value;
        scratch.weaponColumn = columnNumber;
        scratch.weaponField = column.rawName;
      }
    } else if (column.role.kind === "hpArc") {
      const scratch = ensure(column.role.slot);
      if (!scratch.arcSeen) {
        scratch.arcSeen = true;
        const value = rawCell.trim();
        scratch.arcRaw = value === "" ? null : value;
        scratch.arcColumn = columnNumber;
        scratch.arcField = column.rawName;
      }
    } else if (column.role.kind === "ftLoad") {
      const scratch = ensure(column.role.slot);
      if (!scratch.loadSeen) {
        scratch.loadSeen = true;
        const parsed = parseNumberCell(rawCell);
        if (parsed.kind === "bad") {
          scratch.load = 0;
          diagnostics.push(
            makeDiagnostic(
              "badNumber",
              "ftrlist",
              "warning",
              file,
              { line: line.line, column: columnNumber, field: column.rawName },
              { raw: rawCell },
            ),
          );
        } else if (parsed.kind === "ok") {
          scratch.load = parsed.value;
        }
      }
    } else {
      const parsed = parseNumberCell(rawCell);
      putField(fields, extra, column.rawName, column.index, parsed.kind === "ok" ? parsed.value : rawCell.trim());
    }
  }

  const race = textRole(byId, "race");
  const typeName = textRole(byId, "typeName");
  const spawnKey = `${race}:${typeName}`;
  const weapons: FighterWeapon[] = [];
  const slots = [...found.keys()].sort((left, right) => left - right);
  for (const slotIndex of slots) {
    const scratch = found.get(slotIndex);
    if (!scratch) continue;
    let arc: string | null = scratch.arcRaw;
    let reload: number | null = null;
    if (scratch.weapon != null) {
      const interpreted = interpretWeaponArc(scratch.weapon, scratch.arcRaw);
      arc = interpreted.arc;
      reload = interpreted.reloads;
      if (checkVocabulary && interpreted.unknownWeapon) {
        diagnostics.push(
          makeDiagnostic(
            "unknownWeapon",
            "loader",
            "warning",
            file,
            { line: line.line, column: scratch.weaponColumn, field: scratch.weaponField },
            { spawnKey, slotIndex, code: scratch.weapon },
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
              column: scratch.arcColumn ?? scratch.weaponColumn,
              field: scratch.arcField ?? scratch.weaponField,
            },
            { spawnKey, slotIndex, code: interpreted.arcCode },
          ),
        );
      }
    }
    weapons.push({
      slotIndex,
      count: scratch.count,
      weapon: scratch.weapon,
      arc,
      load: scratch.load,
      reload,
    });
  }

  if (present.has("race")) {
    const value = textRole(byId, "race");
    if (value !== "" && !isKnownRace(value)) {
      const at = roleAt.race;
      diagnostics.push(
        makeDiagnostic(
          "unknownRace",
          "ftrlist",
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
          "ftrlist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { first, last },
        ),
      );
    }
  }

  if (shipClassNames && present.has("shipClassRef")) {
    const shipClassRef = textRole(byId, "shipClassRef");
    if (shipClassRef !== "" && !shipClassNames.has(shipClassRef.toLowerCase())) {
      const at = roleAt.shipClassRef;
      diagnostics.push(
        makeDiagnostic(
          "missingShipRef",
          "ftrlist",
          "warning",
          file,
          { line: line.line, column: at?.column, field: at?.field },
          { shipClassRef, typeName },
        ),
      );
    }
  }

  return {
    row: { line: line.line, fields, weapons, raw: cells.slice(), extra },
    race,
    typeName,
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

function putField(
  fields: Record<string, string | number>,
  extra: Record<string, string | number>,
  rawName: string,
  index: number,
  value: string | number,
): void {
  if (!Object.prototype.hasOwnProperty.call(fields, rawName)) {
    assignOwn(fields, rawName, value);
    return;
  }
  extra[`col${index}`] = value;
}

function extrasHaveText(cells: string[], from: number): boolean {
  for (let index = from; index < cells.length; index++) {
    if (cells[index].trim() !== "") return true;
  }
  return false;
}

function emitDuplicateTypes(
  identities: Array<{ line: number; race: string; typeName: string }>,
  file: string | undefined,
  diagnostics: Diagnostic[],
): void {
  const byType = new Map<string, { typeName: string; rows: number[] }>();
  for (const identity of identities) {
    if (identity.typeName === "") continue;
    const key = identity.typeName.toLowerCase();
    const existing = byType.get(key);
    if (existing) existing.rows.push(identity.line);
    else byType.set(key, { typeName: identity.typeName, rows: [identity.line] });
  }
  for (const group of byType.values()) {
    if (group.rows.length < 2) continue;
    diagnostics.push(
      makeDiagnostic(
        "duplicateFighterType",
        "ftrlist",
        "error",
        file,
        { line: group.rows[group.rows.length - 1] },
        { typeName: group.typeName, rows: group.rows },
      ),
    );
  }
}
