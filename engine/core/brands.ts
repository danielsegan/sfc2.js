/** Branded integers. The brand is erased; ESLint enforces the numeric rules. */
export type Fx = number & { readonly __fx: unique symbol };
export type Angle16 = number & { readonly __a16: unique symbol };
export type Tick = number & { readonly __tick: unique symbol };
export type EntityId = number & { readonly __eid: unique symbol };

export function asTick(n: number): Tick {
  return (n >>> 0) as Tick;
}

export function asEntityId(n: number): EntityId {
  return (n >>> 0) as EntityId;
}
