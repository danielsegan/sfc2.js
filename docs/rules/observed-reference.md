# Observed duel reference

Status: **clean-room notes from gameplay.** These are readings taken while watching the original Community Edition 2.670 on a private machine. They are not a copied table, and they are not a quote from a rulebook. The sim stores the integer fit in the synthetic rule files. A player's own install still supplies per-ship power and the turn-curve key.

Confidence is H, M, or L. `duel:metrics` prints our value, this reference, the confidence, and pass or fail. A point passes within 10%. A delay band passes when our value sits inside the band. A weapon roll passes when the seeded sample sits inside the observed min and max.

## Normal turn

F-CA, confidence H. About 4.65 / 7.85 / 7.42 / 7.29 degrees per second at speeds 5 / 10 / 15 / 30.5. The pause after the order is about 1.0 to 1.9 seconds. The earlier F-CA curve already sat inside about 5% of those rates, so those points stayed. The high end now includes speed 30.5 so the 7.29 reading is on the curve.

K-D7-like, confidence M. About 5.0 / 8.6 / 8.4 / 9.3 / 9.4 degrees per second at speeds 5 / 10 / 15 / 20 / 31. The pause is about 1.0 to 1.8 seconds. The previous D7-like curve was about 15% fast at speeds 10 and 15, so that row was refit. The start delay is a constant 1.4 seconds, inside the band.

## High-energy turn

F-CA, confidence H for the timing and M for the rate. The pause is about 5.5 to 5.8 seconds. The sweep is about 89 degrees. The rate is about 42 to 52 degrees per second, and about 48 at speed 31. The speed-15 step was raised so it sits inside that rate band.

K-D7-like, confidence L to M. The rate is about 46 to 65 degrees per second and the sweep is about 82 to 98 degrees. The stored sweep stays the 90-degree baseline, which is inside that span. The speed-5 rate was nudged so it is inside the band.

## Acceleration

Confidence M. This was the large gap: ordered speed used to become actual speed on the next tick.

From rest, an F-CA-like hull reaches speeds 5 / 10 / 15 / 20 / 25 / 30 in about 11 / 19 / 30 / 43 / 61 / 77 seconds. A K-D7-like hull does 10 / 18.5 / 28 / 41 / 57 / 76 seconds, and speed 31 at 79 seconds. Slowing down is about 1.1 speed per second.

Ordered speed is still what the energy plan pays for. Actual speed, in hundredths, walks toward that order on the two hulls above. Other hulls keep the old per-order clamp and read their acceleration from the install as before. Movement energy stays 1 per ordered speed point.

## Energy

Confidence H. With life support and fire control on, the systems load is speed + 2.5. Power left for weapons is the plant minus that load.

An F-CA-like plant is 34, so weapons see 31.5 / 21.5 / 11.5 / 1.0 at speeds 0 / 10 / 20 / 30.5. A K-D7-like plant is 39, so weapons see 36.5 / 26.5 / 16.5 / 5.5 at speeds 0 / 10 / 20 / 31. Life support is 1.5 and fire control is 1. A real install still computes plant output from its own power columns.

## Phaser-1

Confidence M on the edges and the maximum, L on the expected center. Each mount rolls once on the `combat` stream, uniform between the inclusive ends.

| Range | Min–max | Expected |
| --- | --- | --- |
| 0–2 (0 grouped with 1–2) | 4–8 | 5 |
| 3–4 | 3–6 | 4 |
| 5 (the 4–5 group; 4 stays on the inner band) | 2–5 | 3.5 |
| 6–10 | 0–4 | 2 |
| 11–15 | 0–3 | 1 |
| 16–30 | 0–2 | 0.4 |

Nothing past about 30. The long-run mean of a uniform roll is the middle of the band, not the low-confidence expected center. The metric passes a sample that lands inside the band.

## Photon

Cost confidence H, time confidence M. Arming draws 2 per tube per rules-turn until 4 is stored, and the tube is not ready before two rules-turns. One rules-turn is `RULES_TURN_SECONDS` (33 seconds, the whole-second fit of the about-33-second reading), so the tube is ready at 66 seconds. After that, holding the tube costs 1 per rules-turn. Dropping the hold clears the charge at the end of the plan.

Expected damage per tube: 8 inside range 2, 6.5 at 3, 5 at 4–5, 4 at 6–10, 2.5 at 11–12, and 1 at 13–30. A shared edge stays on the inner band. The sim stores those as hundredths of a point. Overload numbers are still the old placeholder.

## Disruptor

Cost confidence M, time confidence L. It draws 2 per rules-turn, spread across the turn, and is ready after one rules-turn (33 seconds). The same 2 keeps it armed. Overload draws 4 per rules-turn and is ready after that same turn.

Damage on a hit is fixed. A miss deals 0 and does not roll damage. One tenth of a k is 100 range units. A labeled band start belongs to that band, and the range below it stays on the inner band. Normal damage and hit chance: 0–1k is 5 at 100%, 1.1–2k is 5 at 80%, 2.1–3k is 4 at 75%, 3.1–5k is 4 at 62.5% (5/8), 5.1–16k is 3 at 66.7% (stored as 667/1000), and 16.1–31k is 2 at 50%. The check ranges 0, 1, 2, 3, 4, 8, 11, 15, 20, and 25 deal 5, 5, 5, 4, 4, 3, 3, 3, 2, and 2 when the shot hits. Certainty does not draw. The normal cutoff is measured at exactly 31.0k (`DISRUPTOR_MAX_RANGE` is 31000). Overload is unchanged: 0–1k is 10 at 100%, 1.1–2k is 10 at 80%, 2.1–4.9k is 8 at 81%, and 5–9k is 6 at 83%. Past exactly 9.0k an overload shot does nothing. Energy is 2 per mount for normal and 4 per mount for overload.

## Shields

Confidence M. Six facings of 60 degrees, with boundaries near ±30, ±90, and ±150 degrees. The sim already used that split, so the bins were left as they were.
