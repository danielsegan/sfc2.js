import { describe, expect, it } from 'vitest';
import { readU32 } from '../../core/bytes.ts';
import { MODE_OVERLOAD } from '../../sim/rules-tables.ts';
import { shipView } from '../../sim/hull.ts';
import { CLOAK_DISENGAGING, CLOAK_ENGAGING, CLOAK_OFF, CLOAK_ON } from '../../sim/phase3.ts';
import {
  C,
  CR,
  CRAFT,
  CRAFT_FIELDS,
  EVENT_CRAFT,
  EVENT_CRAFT_NOTE,
  NOTE_DETONATED,
  NOTE_LAUNCHED,
  NOTE_STRIKE,
  ROLE_FIGHTER,
  ROLE_MINE,
  ROLE_PF,
  STATE_RETURN,
  VERB_RAID,
} from '../../sim/smallcraft.ts';
import { EVENT_SPAWN } from '../../sim/combat.ts';
import { EVERY_EMPIRE_LINE, everyEmpire, everyEmpireScript } from './every-empire.ts';

const LINE = ['Federation', 'Klingon', 'Romulan', 'Lyran', 'Hydran', 'Gorn'];

function i32(buf: Uint8Array, offset: number): number {
  return readU32(buf, offset) | 0;
}

describe('every-empire skirmish', () => {
  it('fields one AI ship from each empire on the six-ship line', () => {
    expect([...EVERY_EMPIRE_LINE]).toEqual(LINE);
    const seen = new Set(EVERY_EMPIRE_LINE);
    expect(seen.size).toBe(6);
  });

  it('uses EW, overload, boarding, tractors, cloaks, mines, fighters, and PFs', () => {
    const sim = everyEmpire.create(everyEmpireScript.seed);
    const again = everyEmpire.create(everyEmpireScript.seed);
    const used = {
      ecm: false,
      eccm: false,
      overload: false,
      tractor: false,
      cloakUp: false,
      cloakDown: false,
      mineLaid: false,
      mineDetonated: false,
      fighter: false,
      fighterStrike: false,
      pf: false,
      recall: false,
      boarding: false,
      hitAndRun: false,
    };
    const cloakRaised = [false, false, false, false, false, false];
    for (let n = 0; n < everyEmpireScript.ticks; n++) {
      const queued = sim.snapshot().queued;
      const raidModes: number[] = [];
      if ((sim.tick as number) >= 2) {
        for (const cmd of queued) {
          expect(cmd.slot).toBeGreaterThanOrEqual(8);
          expect(cmd.slot).toBeLessThanOrEqual(15);
        }
      }
      const raids = queued.filter((cmd) => cmd.kind === VERB_RAID);
      raids.sort((a, b) => a.slot - b.slot || a.seq - b.seq);
      for (const cmd of raids) raidModes.push(i32(cmd.payload, 8));
      const left = sim.step([]);
      const right = again.step([]);
      expect(left.hash).toBe(right.hash);
      let raidAt = 0;
      for (const event of left.events) {
        if (event.kind === EVENT_SPAWN && event.b === 1) used.fighter = true;
        if (event.kind === EVENT_SPAWN && event.b === 2) used.pf = true;
        if (event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_STRIKE) used.fighterStrike = true;
        if (event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_DETONATED) used.mineDetonated = true;
        if (event.kind === EVENT_CRAFT_NOTE && event.a === NOTE_LAUNCHED) {
          const snap = sim.snapshot();
          const craft = snap.world.tables.find((table) => table.id === CRAFT);
          const index = event.entity & 0xffff;
          if (craft && snap.world.live[index] === 1) {
            const role = craft.data[index * CRAFT_FIELDS + C.role] ?? 0;
            if (role === ROLE_MINE) used.mineLaid = true;
            if (role === ROLE_FIGHTER) used.fighter = true;
            if (role === ROLE_PF) used.pf = true;
          }
        }
        if (event.kind === EVENT_CRAFT && (event.entity & 0xffff) < 6) {
          const reason = event.a;
          if (reason === CR.ok || reason === CR.raidRepulsed || reason === CR.boardingRepulsed) {
            const mode = raidModes[raidAt] ?? -1;
            raidAt += 1;
            if (mode === 1) used.boarding = true;
            if (mode === 0) used.hitAndRun = true;
          }
        }
      }
      const snap = sim.snapshot();
      for (let index = 0; index < 6; index++) {
        const view = shipView(snap.world, index);
        if (!view.live) continue;
        if (view.ecmPaid > 0) used.ecm = true;
        if (view.eccmPaid > 0) used.eccm = true;
        if (view.tractorLink === 1) used.tractor = true;
        if (view.cloakState === CLOAK_ENGAGING || view.cloakState === CLOAK_ON) {
          used.cloakUp = true;
          cloakRaised[index] = true;
        } else if (cloakRaised[index] && (view.cloakState === CLOAK_DISENGAGING || view.cloakState === CLOAK_OFF)) {
          used.cloakDown = true;
        }
        for (const mount of view.mounts) {
          if (mount.mode === MODE_OVERLOAD && (mount.ticksCharging > 0 || mount.charge100 > 0)) used.overload = true;
        }
      }
      const craft = snap.world.tables.find((table) => table.id === CRAFT);
      if (craft) {
        for (let index = 0; index < snap.world.live.length; index++) {
          if (snap.world.live[index] !== 1) continue;
          const state = craft.data[index * CRAFT_FIELDS + C.state] ?? 0;
          const role = craft.data[index * CRAFT_FIELDS + C.role] ?? 0;
          if ((role === ROLE_FIGHTER || role === ROLE_PF) && state === STATE_RETURN) used.recall = true;
        }
      }
    }
    expect(used).toEqual({
      ecm: true,
      eccm: true,
      overload: true,
      tractor: true,
      cloakUp: true,
      cloakDown: true,
      mineLaid: true,
      mineDetonated: true,
      fighter: true,
      fighterStrike: true,
      pf: true,
      recall: true,
      boarding: true,
      hitAndRun: true,
    });
  });
});
