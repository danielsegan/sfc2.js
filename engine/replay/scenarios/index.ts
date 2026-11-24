import { aiRegenScript } from './ai-regen.ts';
import { idleRngScript } from './idle-rng.ts';
import { scriptedDuelScript } from './scripted-duel.ts';
import { everyEmpireScript } from './every-empire.ts';
import { skirmish3v3Script } from './skirmish-3v3.ts';
import type { CorpusScript, Scenario } from './types.ts';

/** Committed corpus, in the order the CLI and the browser harness both walk. */
export const CORPUS: readonly CorpusScript[] = [
  idleRngScript,
  scriptedDuelScript,
  aiRegenScript,
  skirmish3v3Script,
  everyEmpireScript,
];

export const CORPUS_FILES: readonly string[] = CORPUS.map((script) => script.fileName);

export function scenarioById(id: string): Scenario | undefined {
  for (const script of CORPUS) {
    if (script.scenario.id === id) return script.scenario;
  }
  return undefined;
}
