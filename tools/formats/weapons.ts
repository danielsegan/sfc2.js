/**
 * Weapon and arc vocabulary from docs/rules/data/weapon-arcs.json.
 * Codes match exactly, including case. The ten Pla spellings are separate rows.
 * DroI and DroVI are not reload-counted; they keep a letter arc such as ALL.
 */

import table from "../../docs/rules/data/weapon-arcs.json" with { type: "json" };

interface WeaponRow {
  internal?: string;
  reloadCounted?: boolean;
  weaponId?: string;
}

const shipWeapons = table.ship.weapons as Record<string, WeaponRow>;
const fighterWeapons = table.fighter.weapons as Record<string, WeaponRow>;

export const WEAPON_DEFS: Readonly<Record<string, WeaponRow>> = {
  ...shipWeapons,
  ...fighterWeapons,
};

export const ARC_CODES: ReadonlySet<string> = new Set(Object.keys(table.ship.arcs));

export const RELOAD_TOKENS: ReadonlySet<string> = new Set(table.reloadCountTokens);

/** The ten CE Pla spellings. Any other spelling, including PLAF or plaF, is unknown. */
export const PLA_CODES = [
  "PlaD",
  "PlaF",
  "PlaG",
  "PlaI",
  "PlaR",
  "PlaS",
  "PLaF",
  "PLaG",
  "PLaR",
  "PLaS",
] as const;

export const RELOAD_COUNTED = ["DroA", "DroB", "DroC", "DroF", "DroG", "ADD6", "ADD12"] as const;

export interface ArcInterpretation {
  arc: string | null;
  reloads: number | null;
  unknownWeapon: boolean;
  unknownArc: boolean;
  /** Arc text for an `unknownArc` diagnostic. Empty when the cell was empty. */
  arcCode: string;
}

/**
 * Reload-counted racks take an Arc cell of exactly `1`, `2` or `3`.
 * That number is `reloads` and the mount has no firing arc.
 * Anything else on those racks is `unknownArc`.
 * A numeric Arc on any other weapon, including DroI and DroVI, is `unknownArc`.
 * An empty Arc on a non-reload weapon is silent.
 */
export function interpretWeaponArc(weapon: string, arcCell: string | null): ArcInterpretation {
  const known = Object.prototype.hasOwnProperty.call(WEAPON_DEFS, weapon);
  const def = known ? WEAPON_DEFS[weapon] : undefined;
  const text = arcCell == null || arcCell.trim() === "" ? null : arcCell.trim();
  if (def?.reloadCounted === true) {
    if (text != null && RELOAD_TOKENS.has(text)) {
      return {
        arc: null,
        reloads: Number(text),
        unknownWeapon: false,
        unknownArc: false,
        arcCode: text,
      };
    }
    return {
      arc: text,
      reloads: null,
      unknownWeapon: false,
      unknownArc: true,
      arcCode: text ?? "",
    };
  }
  if (text == null) {
    return { arc: null, reloads: null, unknownWeapon: !known, unknownArc: false, arcCode: "" };
  }
  const numeric = RELOAD_TOKENS.has(text) || /^[+-]?\d+$/.test(text);
  if (numeric || !ARC_CODES.has(text)) {
    return { arc: text, reloads: null, unknownWeapon: !known, unknownArc: true, arcCode: text };
  }
  return { arc: text, reloads: null, unknownWeapon: !known, unknownArc: false, arcCode: text };
}
