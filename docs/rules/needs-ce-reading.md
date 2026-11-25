# Needs CE reading

Placeholder numbers in the Phase 2 duel. Each one stays until a Community Edition 2.670 gameplay reading replaces it. Nothing here is a copied table.

| Topic | Placeholder | Where |
| --- | --- | --- |
| Energy priority when unset | 3. A set priority of 1 is paid before 5. Life support and fire control stay ahead of the five sliders. | `defaultEnergyPriority` |
| Battery discharge | On until `setBattery(false)`. Surplus still charges the battery. Drain and recharge rates are the whole surplus or the whole shortfall in one plan. | `powerPlan.batteryMode` |
| Shield Down / Minimal / Up | Down clears the six facings. Minimal and Up restore each facing to its maximum. Minimal and Down accept no reinforcement energy. Up does. | `VERB_SET_SHIELD_STATE` |
| Repair rate | 1 box every 30 ticks, front of the queue first. Crew maximum is the crew at spawn. Marines are 0. | `repairEveryTicks` |
| Photon overload | Arm cost 8, arm ticks two rules-turns on `Phot`, hold 1, damage 12. The hold is the same field as a normal tube. | `Phot` overload fields |
| Disruptor damage | A shot in range applies 0 until the measured table lands. | disruptor `directDamage` |
