/** Element ids measured per skin. The test reads their rendered boxes. */
export const HIT_TARGET_IDS = [
  'pause',
  'ui-scale',
  'player-ship',
  'opponent-ship',
  'keys-open',
  'load',
  'helm-n',
  'helm-orbit',
  'helm-go',
  'ordered-speed',
  'shields',
  'space',
  'energy',
  'cloak',
] as const;

export const LOCKED_COLOUR_TOKENS = [
  '--text',
  '--text-dim',
  '--focus',
  '--panel-edge',
  '--state-normal',
  '--state-charging',
  '--state-warning',
  '--state-damage',
  '--state-disabled',
  '--state-friendly',
  '--state-hostile',
] as const;
