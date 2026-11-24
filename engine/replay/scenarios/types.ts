import type { Command } from '../../core/codec.ts';
import type { Sim } from '../../sim/sim.ts';

/**
 * A synthetic script the replay runner can rebuild.
 * `sourcePaths` are repo-relative POSIX paths hashed into scenarioHash.
 * They are not part of versionHash (determinism.md V1).
 */
export interface Scenario {
  readonly id: string;
  readonly sourcePaths: readonly string[];
  create(seed: number): Sim;
}

/** One committed corpus entry. The command list is the player log only. */
export interface CorpusScript {
  readonly scenario: Scenario;
  readonly fileName: string;
  readonly seed: number;
  readonly ticks: number;
  readonly slots: readonly number[];
  readonly inputDelay: number;
  readonly hashPeriod: number;
  readonly commands: readonly Command[];
}
