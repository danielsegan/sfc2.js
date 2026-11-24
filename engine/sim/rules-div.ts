/**
 * Floor division for rules code.
 * Every divisor is rejected here. fx.div's saturation (and the dev-build throw)
 * is only a backstop for callers outside the rules.
 */
import { idiv } from '../core/fx.ts';

export function rulesDiv(n: number, d: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error('rules divisor');
  return idiv(n, d);
}
