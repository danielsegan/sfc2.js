# ADR 0002: Replay corpus and hash gate

Status: accepted for [#25](https://github.com/danielsegan/sfc2.js/issues/25).
Byte layout: [replay.md](../engine/replay.md). Normative rules: [determinism.md](../engine/determinism.md).

## Decision

A replay is a versioned little-endian file: match seed, `versionHash` (format + sim source hash + data hash), a separate scenario hash, the player command log, a tick-0 snapshot, and a hash sample per tick (`stateHash` and `eventHash`).

`pnpm replay:check` replays `replays/*.s2replay` and fails on a stale stamp or the first divergent tick. Playwright runs the same files in Chromium, Firefox, and WebKit and compares those timelines to Node.

The corpus is synthetic scripted scenarios. AI and mission commands are not stored; the scenario regenerates them.

## Consequences

- Bump `REPLAY_FORMAT` when the envelope layout changes. A sim-source edit is caught by `simSourceHash` without a format bump.
- Scenario scripts live in `engine/replay/scenarios` and are not part of `versionHash`. `scenarioHash` still rejects a stale script.
- The browser job does not recompute source hashes. The Node job does.
