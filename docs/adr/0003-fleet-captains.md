# ADR 0003: Fleet sides and deterministic captains

Status: accepted for the Phase 3 skirmish slice.

## Decision

A skirmish has one to six ships. Each ship is on side 0 or side 1. The side is a sim component (`allegiance`), set by verb 7. Verb 6 stays helm. Combat verbs stay 1–5. A zeroed row means the ship was not assigned a side, which keeps the old one-on-one duel hostile to its single opponent.

Captains run in the AI phase. They queue `setEnergy`, helm yaw, `fire`, and the Phase 3 verbs (`setEw`, `setWeaponMode`, `setTractor`, `setCloak`, `launchFighter`, `launchPf`, `recall`, `layMine`, `raid`) for the next tick on slots 8–15 (entity index plus 8). Those commands are not stored in the player log. The player's own ship is `manual` and uses the session, which is the same verbs and the same handlers. Small-craft orders are skipped when the match has no craft tables.

Target choice and shield ties draw from the `ai` stream only. A unique choice does not draw. The captain does not read the clock.

## Consequences

- Adding the captain sources changes `simSourceHash`. Replays are re-recorded even when a scenario does not register the captain. Say so in the PR.
- The 3v3 corpus file has an empty player log. The six ships and their orders are rebuilt from the seed.
- Friendly fire is refused in the helm, not in the weapon rules. A manual order at a ship on the same side is dropped before it is queued.
