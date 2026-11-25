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

Ordered speed is still what the energy plan pays for. Actual speed, in hundredths, walks toward that order on F-CA, F-FF, F-DN, and K-D7. Other hulls keep the old per-order clamp and read their acceleration from the install as before. Movement energy stays 1 per ordered speed point.

## Energy

Confidence H. With life support and fire control on, the systems load is speed + 2.5. Power left for weapons is the plant minus that load.

An F-CA-like plant is 34 [H], so weapons see 31.5 / 21.5 / 11.5 / 1.0 at speeds 0 / 10 / 20 / 30.5. F-DN is 53 [H]. F-FF's POWER 15 reading is not the probe plant, because that checkpoint also flew speed 20 and a top of 31. A K-D7-like plant is 39, so weapons see 36.5 / 26.5 / 16.5 / 5.5 at speeds 0 / 10 / 20 / 31. Life support is 1.5 and fire control is 1. A real install still computes plant output from its own power columns.

## Phaser-1

Confidence M. Each mount rolls once on the `combat` stream, uniform between the inclusive ends. Ranges are thousands of range units. A shared edge stays on the inner band. Nothing past 30k. The reading puts the cutoff somewhere in 26–30k.

| Range | Min–max | Expected |
| --- | --- | --- |
| 0–1k | 6–7 | 6.5 |
| 1–3k | 4–5 | 4.5–5 |
| 3–5k | 4 | 4.0 |
| 5–10k | 1–2 | 1–2 |
| 10–15k | 0–1 | 0.7–1.0 |
| 15–30k | 0–1 | 0.5 |

The 10–15k uniform mean is 0.5, under the 0.7–1.0 center. The metric passes a sample inside the roll. Capacitor fill of about 35 seconds is not a separate clock.

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

Confidence M. F-FF. Under 4k the roll is 1–2, mean about 1.5. From 4k through 10.3k the shot is 0. Nothing past 10.3k.

## Photon

Cost confidence H, time confidence M. Arming draws 2 per tube per rules-turn until 4 is stored, and the tube is not ready before two rules-turns. One rules-turn is `RULES_TURN_SECONDS` (33 seconds, the whole-second fit of the about-33-second reading), so the tube is ready at 66 seconds. After that, holding the tube costs 1 per rules-turn. Dropping the hold clears the charge at the end of the plan.

A hit is 8 points at every range, stored as hundredths. Chance: 100% at 0–1k, 81% at 1–3k, 62.5% (5/8) at 3–5k, 40% (inside the 31–50% reading) at 5–10k, 25% (inside 12.5–31%) at 10–15k, and 12.5% (1/8) from 15k through 30k. A shared edge stays on the inner band. Nothing past 30k. The reading puts the cutoff somewhere in 26–30k. Arming at full allocation was about 64 seconds; the sim stays at two rules-turns, 66 seconds, which is inside 10% of that reading. Overload numbers are still the old placeholder.

## Disruptor

Cost confidence M, time confidence L. It draws 2 per rules-turn, spread across the turn, and is ready after one rules-turn (33 seconds). The same 2 keeps it armed. Overload draws 4 per rules-turn and is ready after that same turn.

Damage on a hit is fixed. A miss deals 0 and does not roll damage. One tenth of a k is 100 range units. A labeled band start belongs to that band, and the range below it stays on the inner band. Normal damage and hit chance: 0–1k is 5 at 100%, 1.1–2k is 5 at 80%, 2.1–3k is 4 at 75%, 3.1–5k is 4 at 62.5% (5/8), 5.1–16k is 3 at 66.7% (stored as 667/1000), and 16.1–31k is 2 at 50%. The check ranges 0, 1, 2, 3, 4, 8, 11, 15, 20, and 25 deal 5, 5, 5, 4, 4, 3, 3, 3, 2, and 2 when the shot hits. Certainty does not draw. The normal cutoff is measured at exactly 31.0k (`DISRUPTOR_MAX_RANGE` is 31000). Overload is unchanged: 0–1k is 10 at 100%, 1.1–2k is 10 at 80%, 2.1–4.9k is 8 at 81%, and 5–9k is 6 at 83%. Past exactly 9.0k an overload shot does nothing. Energy is 2 per mount for normal and 4 per mount for overload.

## Shields

Confidence M–H. F-CA, clockwise from the bow: forward 330–30°, starboard-forward 30–90, starboard-aft 90–150, rear 150–210, port-aft 210–270, port-forward 270–330. That is the equal 60° split the sim already used, so the bins were left as they were. A hit on a boundary can drop both adjacent facings. The sim still assigns the boundary to the clockwise-next facing.
