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
| F-FF plant | POWER 15 [H]. The same checkpoint flew speed 20 and a top of 31, which this plant cannot pay at 1 point per speed, so the probe keeps warp 34. | — |
| F-FF HET slope | 55.5 was reported next to the 49°/s rate [H]. The table stores the rate, not the slope. | `F-FF` HET |
| F-FF accel window | About 0.82 speed/s and 38 s to speed 31 are in the curve. The sample that started at 6.6 is not a second segment. | `accel.json` |
| F-DN accel window | About 0.31 speed/s is in the curve. The 64 s sample that started at 7.8 is not a second segment. | `accel.json` |
| Hull top speeds | F-FF 31.0, F-DN 30.46, F-CA 30.5, K-D7 31.09. Not a per-hull cap. The probe still orders up to the plant, then 32. | — |
| Phaser capacitor fill | About 35 s [M]. The capacitor still fills from overflow on the energy plan. | — |
| Phaser-2 re-arm | About 17–18.5 s [M]. The charge still fills from the energy plan. | `Ph2` |
| Shield boundary | A hit on a facing boundary can drop both adjacent facings [M–H]. The sim still assigns the clockwise-next facing only. | `facingForRelative` |
| K-D7 checkpoint 2 | Single-run turn 9.0–9.1 °/s and HET 52–58 °/s. The #161 aggregates stay. POWER 39 [H] matches the probe. | — |
| K-E4 HET retry | A second HET sample was 50 °/s. The table stores 70 °/s. | `K-E4` HET |
| Low POWER vs top speed | K-E4, K-F5, L-FF, H-HN, G-FF, and I-FF read POWER 15 or 20 while the top speed is about 31. R-SNA POWER 7 is energy-capped at 22. The probes keep warp 34 so the turn can be ordered. | — |
| L-CA mis-tag | The live 14.9 °/s with a 5.2 s delay looks like a HET [L]. Ignored. | `L-CA` |
| L-DN HET outlier | One 19.9 °/s HET reading is ignored. | `L-DN` |
| L-FF outlier | One 28 °/s run is ignored. Gold hull tracking is poor [M–L]. | `L-FF` |
| G-FF and I-FF mis-tags | Speed-5 G-FF runs of 14–17 °/s and the I-FF 15.5 °/s at speed 10 look like mis-tagged HETs [L]. Ignored. | — |
| I-CA mis-tags | 22–25 °/s at speeds 15 and 31 are [L]. Ignored. | `I-CA` |
| Plasma falloff | HUD readouts stay flat. One ISC Plasma-G volley that read 60 hit for about 19 shield points at 14.4k [L–M]. No in-flight falloff table. | `PlaF` `PlaG` `PlaR` `PlaS` |
| Plasma-D | Defensive. The HUD read 0. No damage table. | `PlaD` |
| Plasma both tubes | Plasma-S both tubes together were about 135 s. Each tube is about 95 s. | `PlaS` |
| ESG damage | The volley HUD reads 0 and each mount draws 3 power continuously. Contact damage is unmeasured, and the 3-power draw is not a sim consumer yet. | `ESG` |
| Hellbore past 21.4k | Measured bands stop at 21.4k. The real cutoff is farther and unread. | `HB` |
| PPD 18–25k | The step between 18k and 25.5k was not sampled. A shot in that gap does not pick a damage. | `PPD` |
| Phaser-1 ISC tail | The ISC curve still does a little damage out to about 30k [M]. The common table uses the Gorn cutoff at 26.4k [H]. | `Ph1` |
| Phaser-2 Lyran tail | Lyran Phaser-2 expected 0 past 3.3k. The #161 K-D7 curve still has a tail. Not overwritten. | `Ph2` |
| Disruptor-4 Lyran close range | Lyran Disruptor-4 read 0–5 at 1.4k. The K-C8 table starts at 2.4k. Both are kept as a note, not two codes. | `Dis4` |
| Phaser capacitor 32–34 s | Klingon about 32 s, Lyran about 32–34 s. Still not a separate clock. | — |
| Drone reload | Rack F reload is about 65–68 s. Initial arm is 44 s. Reload is not a second clock. | `DroF` |
| Red Alert charge | Phasers, disruptors, and plasma charge only at Red Alert in NORMAL. Green Alert leaves drone racks able to charge. `setEnergy` flag bit 16 orders Green. The HUD does not send it yet. | `H.alert` |
