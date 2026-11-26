# Observed duel reference

Status: **clean-room notes from gameplay.** These are readings taken while watching the original Community Edition 2.670 on a private machine. They are not a copied table, and they are not a quote from a rulebook. The sim stores the integer fit in the synthetic rule files. A player's own install still supplies per-ship power and the turn-curve key.

Confidence is H, M, or L. `duel:metrics` prints our value, this reference, the confidence, and pass or fail. A point passes within 10%. A delay band passes when our value sits inside the band. A weapon roll passes when the seeded sample sits inside the observed min and max.

## Normal turn

F-CA, confidence H. About 4.65 degrees per second at speed 5, and 7.3 to 7.9 from speed 10 through 30.5. The pause after the order is about 1.0 to 1.9 seconds.

F-FF, confidence H. 5.1 / 9.5 / 9.9 / 10.0 degrees per second at speeds 5 / 10 / 15 / 20. The pause is 1.1 seconds.

F-DN, confidence H. 4.3 / 6.2 / 6.9 / 7.4 degrees per second at speeds 5 / 10 / 16 / 20. The pause is 1.2 seconds.

K-D7-like, confidence M. About 5.4 degrees per second at speed 5, and 9.0 to 9.4 from speed 10 through 31. The pause is about 0.7 to 1.8 seconds. The start delay is a constant 1.4 seconds, inside the band.

## High-energy turn

F-CA, confidence M. The pause is about 5.5 to 6.0 seconds. The sweep is about 89 degrees; the stored sweep stays 90 degrees, which is inside 10% of that reading. The rate is about 42 to 46 degrees per second, with one outlier near 52 at the top speed.

F-FF, confidence H. About 49 degrees per second, delay 5.35 seconds. A slope of 55.5 was reported with that rate and is not a second table point.

F-DN, confidence M. About 41.7 degrees per second, delay 5.6 seconds.

K-D7-like, confidence H. The rate is 57.8 to 59.0 degrees per second and the delay is 5.45 to 5.93 seconds. The stored sweep stays the 90-degree baseline.

## Acceleration

Confidence M for F-CA and K-D7, H for the Federation frigate and dreadnought rates.

F-CA low speed is 0.285 to 0.31 speed per second. From rest it reaches speed 20 in about 61 seconds and speed 30.5 in about 78.7 seconds. The quoted 0.356 average from 3.5 to 30.5 does not also fit those two clocks, so the clocks and the low rate are the fit.

F-FF is about 0.82 speed per second, and speed 31 is about 38 seconds from rest.

F-DN is about 0.31 speed per second.

K-D7 low speed is 0.27 to 0.29. Speed 31 is about 79.6 seconds from rest. The quoted 0.344 average loses to that top clock where they disagree.

Slowing down is about 1.1 speed per second on every listed hull.

Ordered speed is still what the energy plan pays for. Actual speed, in hundredths, walks toward that order on the hulls that have an acceleration band, including the checkpoint hulls. Movement energy stays 1 per ordered speed point.

## Energy

Confidence H. With life support and fire control on, the systems load is speed + 2.5. Power left for weapons is the plant minus that load.

An F-CA-like plant is 34 [H], so weapons see 31.5 / 21.5 / 11.5 / 1.0 at speeds 0 / 10 / 20 / 30.5. F-DN is 53 [H]. F-FF's POWER 15 reading is not the probe plant, because that checkpoint also flew speed 20 and a top of 31. A K-D7-like plant is 39, so weapons see 36.5 / 26.5 / 16.5 / 5.5 at speeds 0 / 10 / 20 / 31. Life support is 1.5 and fire control is 1. A real install still computes plant output from its own power columns.

## Phaser-1

Confidence H, from the Gorn dreadnought. This is the common table. Each mount rolls once on the `combat` stream, uniform between the inclusive ends. A shared edge stays on the inner band. Nothing past 26.4k. An ISC reading still shows a little damage out to about 30k [M]. That longer tail is not a second table.

| Range | Min–max |
| --- | --- |
| 0–2k | 3–6 |
| 2–4k | 2–4 |
| 4–6k | 2–3 |
| 6–9k | 1–2 |
| 9–15k | 0–1 |
| 15–26k | 0–1 |
| 26.4k | 0 |

Capacitor fill of about 32–35 seconds is not a separate clock.

## Phaser-2

Confidence M. K-D7, same kind of roll. Re-arm of about 17–18.5 seconds is not a separate clock.

| Range | Min–max | Expected |
| --- | --- | --- |
| 0–1k | 5–6 | 5.25 |
| 1–2k | 3–5 | 4.0 |
| 2–3k | 3–4 | 3.4 |
| 3–4k | 3–4 | 3.3 |
| 4–5k | 0–1 | 0.5 |
| 5–8k | 0–1 | 0.3 |
| 8k through 16k | 0 | about 0 |

Nothing past 16k.

## Phaser-3

Confidence H from the ISC dreadnought, which tightens the earlier F-FF reading. Inside 2k the roll is about 1.5–2. At 2–3k it is about 1–1.5. At 3–4k it is under 0.5. Nothing past 4.2k. An earlier “nonzero max” of about 16k is not the effective range.

## Photon

Cost confidence H, time confidence M. Arming draws 2 per tube per rules-turn until 4 is stored, and the tube is not ready before two rules-turns. One rules-turn is `RULES_TURN_SECONDS` (33 seconds, the whole-second fit of the about-33-second reading), so the tube is ready at 66 seconds. After that, holding the tube costs 1 per rules-turn. Dropping the hold clears the charge at the end of the plan.

A hit is 8 points at every range, stored as hundredths. Chance: 100% at 0–1k, 81% at 1–3k, 62.5% (5/8) at 3–5k, 40% (inside the 31–50% reading) at 5–10k, 25% (inside 12.5–31%) at 10–15k, and 12.5% (1/8) from 15k through 30k. A shared edge stays on the inner band. Nothing past 30k. The reading puts the cutoff somewhere in 26–30k. Arming at full allocation was about 64 seconds; the sim stays at two rules-turns, 66 seconds, which is inside 10% of that reading. Overload numbers are still the old placeholder.

## Disruptor

Cost confidence M, time confidence L. It draws 2 per rules-turn, spread across the turn, and is ready after one rules-turn (33 seconds). The same 2 keeps it armed. Overload draws 4 per rules-turn and is ready after that same turn.

Damage on a hit is fixed. A miss deals 0 and does not roll damage. One tenth of a k is 100 range units. A labeled band start belongs to that band, and the range below it stays on the inner band. Normal damage and hit chance: 0–1k is 5 at 100%, 1.1–2k is 5 at 80%, 2.1–3k is 4 at 75%, 3.1–5k is 4 at 62.5% (5/8), 5.1–16k is 3 at 66.7% (stored as 667/1000), and 16.1–31k is 2 at 50%. The check ranges 0, 1, 2, 3, 4, 8, 11, 15, 20, and 25 deal 5, 5, 5, 4, 4, 3, 3, 3, 2, and 2 when the shot hits. Certainty does not draw. The normal cutoff is measured at exactly 31.0k (`DISRUPTOR_MAX_RANGE` is 31000). Overload is unchanged: 0–1k is 10 at 100%, 1.1–2k is 10 at 80%, 2.1–4.9k is 8 at 81%, and 5–9k is 6 at 83%. Past exactly 9.0k an overload shot does nothing. Energy is 2 per mount for normal and 4 per mount for overload.

## Checkpoints 2–5

Motion for K-E4, K-F5, K-C8, R-SNA, R-KRC, R-CON, L-FF, L-CA, L-DN, H-HN, H-RN, H-PAL, G-FF, G-CA, G-DN, I-FF, I-CA, and I-DN is in the turn, HET, and acceleration tables. Each new hull is scored at one measured speed. K-D7 turn, HET, and acceleration stay on the earlier aggregates. A plant that can pay the flown top speed is the probe plant, and weapons at speed 0 are plant minus 2.5. Plants that cannot (POWER 15 or 20, and the R-SNA POWER 7 cap) stay in needs-ce-reading.md, and those probes stay at warp 34 so the turn can be ordered.

Disruptor-1 (E4, F5, and the matching Lyran short mount) cuts off at 16k: 5 inside 1.6k, then 0–4, then 0–3. Disruptor-3 stays the 31k table above. Disruptor-4 (C8) is its own 31k roll: 0–4, 0–3, 0–2, and it arms in 32 seconds. The Lyran close-range 0–5 is not merged into that table.

Plasma tubes store a launch yield and an arm time only. F and G are 20 and arm in 102 seconds. R is 50 and arms in 124 seconds. S is 30 and arms in about 95 seconds. Plasma-D is defensive and has no damage. Those yields are not impact damage. In-flight falloff is unmeasured.

Fusion, hellbore, Phaser-G, and the PPD are range rolls in the weapon table. Hellbore stops at the last measured band, 21.4k. The PPD is 0 under 4k, then 6, 5, 4, an unsampled gap from 18k to 25.5k, then 3 and 2, and nothing past 30.4k. A shot in the gap does not pick a damage. Drone rack F is 12 per drone, arms in 44 seconds, and reaches about 33.5k. ESG contact damage is unmeasured.

## Mirak

Checkpoint 6. Z-FF turns at 6.8 degrees per second at speed 5. Its 15–19 degree readings at speed 10–20, and its HET, stay out of the tables. Z-CA turns at 8.2–8.3 degrees per second at speed 10–20, delay 1.4–1.5 seconds, and its HET is 47–52 degrees per second after 5.6–5.7 seconds [H]. Z-DN turns at 4.0 degrees per second at speed 5 and 6.5 at speed 20, and its HET is about 37 degrees per second at speed 17.6 [M]. Z-CA’s plant is 33 and Z-DN’s is 55. Z-FF’s POWER 15 cannot pay speed 31, so that probe stays at warp 34.

Racks A, B, and C deal 12 per drone, the same yield as Rack F. A and C hold 7, B holds 11. AMD-6 cuts off at 4k and is drone-only. Disruptor-1, Disruptor-3, Disruptor-4, Phaser-1, and Phaser-3 stay the global tables. Across the eight empires, a shared weapon keeps one per-mount table [M–H].

## Plasma-G flight

The HUD volley is the warhead at launch, 20 per tube. The bolt then decays and dies. Speed is 33 range units per tick, so 360 ticks (12 s) is about 11.9k of travel. Impact damage is the yield times the fraction of that life still left. That line is provisional: a short hit read a full 20 where the line says about 17, and an 8k flight of a 60-point volley read about 19 where the line says about 20. F, S, and R do not use this life.

## n=3 motion

F-CA at speed 15 turns at 7.59±0.16 deg/s, which the existing 7.58 point already matches. The delay at that speed is 1.11±0.10 s. The HET there is 49.1 deg/s on the game clock (48.1±3.8 wall) after 5.70±0.09 s. Acceleration is speed 10 at 18.8 s, speed 20 at 41.5 s, and speed 30.5 at 78.70 s.

K-D7 at speed 15 turns at 8.40±0.03 deg/s with a 0.99 s delay. Its HET mean 56.6±2.6 still overlaps 57.8–59, so that rate stays. The speed-15 HET delay is 5.50±0.08 s. The 80.1±0.7 s run to speed 31.09 matches the existing clock.

## Alert

Phasers, disruptors, and plasma take charge only while the ship is at Red Alert and the weapon is in normal mode. Green Alert does not charge those mounts. Drone racks still can. `setEnergy` flag bit 16 orders Green Alert. The default is Red, so an order that omits the flag keeps charging. The HUD does not send the flag yet.

## Shields

Confidence M–H. F-CA, clockwise from the bow: forward 330–30°, starboard-forward 30–90, starboard-aft 90–150, rear 150–210, port-aft 210–270, port-forward 270–330. That is the equal 60° split the sim already used, so the bins were left as they were. A hit on a boundary can drop both adjacent facings. The sim still assigns the boundary to the clockwise-next facing.
