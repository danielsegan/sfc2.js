import { asEntityId, type EntityId } from '../core/brands.ts';

const MAX_SLOTS = 65536;
const INITIAL = 8;

/**
 * Lowest-free-index allocator. The generation bumps on reuse, not on free.
 * A generation that would leave the 16-bit range retires that index.
 * The retire cap itself is still an open question; this is the stand-in.
 */
export class Allocator {
  private gen = new Uint16Array(0);
  private live = new Uint8Array(0);
  private retired = new Uint8Array(0);
  private count = 0;

  get slotCount(): number {
    return this.count;
  }

  isLiveIndex(index: number): boolean {
    return index >= 0 && index < this.count && this.live[index] === 1;
  }

  isRetiredIndex(index: number): boolean {
    return index >= 0 && index < this.count && this.retired[index] === 1;
  }

  idAt(index: number): EntityId {
    return asEntityId((index & 0xffff) | ((this.gen[index]! & 0xffff) << 16));
  }

  isLive(id: EntityId): boolean {
    const index = (id as number) & 0xffff;
    const generation = ((id as number) >>> 16) & 0xffff;
    return this.isLiveIndex(index) && this.gen[index] === generation;
  }

  alloc(): EntityId {
    for (let i = 0; i < this.count; i++) {
      if (this.live[i] === 0 && this.retired[i] === 0) return this.activate(i);
    }
    if (this.count >= MAX_SLOTS) throw new Error('entity capacity exceeded');
    const index = this.count;
    const next = this.count === 0 ? INITIAL : Math.min(MAX_SLOTS, this.count * 2);
    this.grow(next);
    return this.activate(index);
  }

  free(id: EntityId): void {
    if (!this.isLive(id)) throw new Error('free of a dead id');
    this.live[(id as number) & 0xffff] = 0;
  }

  capture(): { generations: number[]; live: number[]; retired: number[] } {
    return {
      generations: Array.from(this.gen),
      live: Array.from(this.live),
      retired: Array.from(this.retired),
    };
  }

  restore(
    slotCount: number,
    generations: readonly number[],
    live: readonly number[],
    retired: readonly number[],
  ): void {
    if (generations.length !== slotCount || live.length !== slotCount || retired.length !== slotCount) {
      throw new Error('allocator restore');
    }
    this.gen = Uint16Array.from(generations);
    this.live = Uint8Array.from(live);
    this.retired = Uint8Array.from(retired);
    this.count = slotCount;
  }

  private activate(index: number): EntityId {
    let generation = this.gen[index] ?? 0;
    if (generation === 0) generation = 1;
    else {
      generation = (generation + 1) & 0xffff;
      if (generation === 0 || generation === 0xffff) {
        this.retired[index] = 1;
        this.gen[index] = 0xffff;
        this.live[index] = 0;
        return this.alloc();
      }
    }
    this.gen[index] = generation;
    this.live[index] = 1;
    return asEntityId((index & 0xffff) | (generation << 16));
  }

  private grow(next: number): void {
    const gen = new Uint16Array(next);
    const live = new Uint8Array(next);
    const retired = new Uint8Array(next);
    gen.set(this.gen);
    live.set(this.live);
    retired.set(this.retired);
    this.gen = gen;
    this.live = live;
    this.retired = retired;
    this.count = next;
  }
}
