# Duel metrics

`pnpm duel:metrics` runs the Phase 2 sim headlessly and prints a scenario definition, a markdown table, and the same report as JSON.

The hulls are synthetic. **F-CA-like** and **K-D7-like** name the `F-CA` and `K-D7` rows of the integer turn curves. Their plants are 34 and 39. Actual speed ramps on those two hulls. `Ph1` rolls a damage band, `Phot` arms over two rules-turns, and the K-D7-like heavy mount is a disruptor. Nothing in this folder is a capture from the original game, and it does not read an install. The comparison numbers are the observed readings in [docs/rules/observed-reference.md](../../docs/rules/observed-reference.md).

A private VM can compare the table with numbers captured there. Every row carries a unit and the scenario block states the order, the positions, and the clock.

## What is measured

| Metric | How |
| --- | --- |
| Turn rate and order-to-turn delay | At speeds 5, 10, 15, 20, and 31. The ship is brought to that speed with `setEnergy` (verb 2), then given a heading order (verb 12, target 16384). Delay is ticks from that order's apply tick until the heading changes. Rate is the BAM change on the first turning tick. deg/s = BAM/tick × 10800 / 65536. |
| Time to speed | `setEnergy` is reissued every tick, asking for the target, until ordered speed matches. Acceleration is 8. The trace is the speed after each apply. |
| Movement energy | Rule points paid by the `setEnergy` that lands on that speed, with life support and weapons off. Also that total per speed point and per tick (the rules-turn is 900 ticks). |
| Phaser damage | `Ph1`, arc `ALL`, pre-charged, fire control already paid. One shot at each probe range in bands 0, 1, 2–3, 4–8, 9–15, 16–25, and 26+ (26 and 30). |
| Heavy weapon | `Phot` normal. Catalog arm cost and arm ticks, the energy actually paid, and the ticks until the mount is ready. Energy is dripped across the rules-turn, so ready time is longer than the catalog arm-tick minimum. |
| Shield facing | A shot from each of six incoming bearings (0, 10923, 21845, 32768, 43691, 54613). Bearing 0 is the bow center. The value is the facing index that took the hit (0 = bow, clockwise). |
| Power left for weapons | At speeds 0, 10, 20, and 31, with life support and fire control on. The value is weapon energy paid after those and after movement. |

Orders use `LocalSession` with input delay 0, so each command is stamped for the next tick, the same stamp the duel match uses for a local player.

The world is the duel combat, cruise, heading, and HET systems. There is no captain and no small craft, so no other orders are queued. The tool does not read the wall clock.

## Run

```bash
pnpm duel:metrics
```

The unit test is `tools/duel-metrics/metrics.test.ts`. It runs the same synthetic hulls and checks the table.
