# Needs CE reading

Placeholder numbers in the Phase 2 duel. Each one stays until a Community Edition 2.670 gameplay reading replaces it. Nothing here is a copied table.

| Topic | Placeholder | Where |
| --- | --- | --- |
| Energy priority when unset | 3. A set priority of 1 is paid before 5. Life support and fire control stay ahead of the five sliders. | `defaultEnergyPriority` |
| Battery discharge | On until `setBattery(false)`. Surplus still charges the battery. Drain and recharge rates are the whole surplus or the whole shortfall in one plan. | `powerPlan.batteryMode` |
| Shield Down / Minimal / Up | Down clears the six facings. Minimal and Up restore each facing to its maximum. Minimal and Down accept no reinforcement energy. Up does. | `VERB_SET_SHIELD_STATE` |
| Repair rate | 1 box every 30 ticks, front of the queue first. Crew maximum is the crew at spawn. Marines are 0. | `repairEveryTicks` |
| Photon overload | Arm cost 8, arm ticks two rules-turns on `Phot`, hold 1, damage 12. The hold is the same field as a normal tube. | `Phot` overload fields |
| Emergency-stop recovery | 90 ticks. Ordered speed stays 0. The stop itself is immediate. | `emerRecoverTicks` |
| Emergency-stop bow shield | 1 point per speed point at the stop, capped at 20, removed when recovery ends. | `emerShieldPerSpeed`, `emerShieldBonusCap` |
| Erratic speed cap | Ordered speed above 16 is cut to 16. | `erraticSpeedCap` |
| Erratic ECM | +1 defensive ECM while on. | `erraticEcmBonus` |
| Erratic own-weapon penalty | 15 points out of 100 removed from the ship's hit chance. | `erraticHitPenalty` |
| Erratic course step | One combat-stream step of −1, 0, or +1, times 200 BAM, each tick. | `erraticYawStep` |
| HET success while erratic | −25 percent. Floor 5. Undamaged and not erratic stays 100, and that case does not draw. | `hetErraticPenalty`, `hetSuccessFloor` |
| HET breakdown | 60 ticks of helm lock and 1 shield point on a combat-stream facing. | `hetBreakdownTicks` |
| HET success and damage | The chance does not fall when hull boxes are missing. A hull maximum is not on the view yet. | — |
| Capacitor rate steps | The order is a 0–1000 permille. Whether CE detents at 25, 50, and 100 percent is unread. | `capacitorRateScale` |
