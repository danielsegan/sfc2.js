import { angle16, type Angle16 } from '../core/angle.ts';
import type { EntityId } from '../core/brands.ts';
import { ByteBuf } from '../core/bytes.ts';
import { fxRaw, type Fx } from '../core/fx.ts';
import { Allocator } from './allocator.ts';

export const ENTITY_KIND = {
  ship: 1,
  fighter: 2,
  mapObject: 3,
  seeker: 4,
} as const;

export type EntityKind = keyof typeof ENTITY_KIND;

export interface TableSpec {
  readonly id: string;
  readonly fieldCount: number;
}

export interface TableSnap {
  readonly id: string;
  readonly fieldCount: number;
  readonly data: readonly number[];
}

export interface WorldSnap {
  readonly slotCount: number;
  readonly generations: readonly number[];
  readonly live: readonly number[];
  readonly retired: readonly number[];
  readonly pendingDespawn: readonly number[];
  readonly tables: readonly TableSnap[];
}

interface Table {
  id: string;
  fieldCount: number;
  data: Int32Array;
}

const BUILTIN: readonly TableSpec[] = [
  { id: 'kind', fieldCount: 1 },
  { id: 'position', fieldCount: 2 },
  { id: 'heading', fieldCount: 1 },
];

export class World {
  private readonly allocator = new Allocator();
  private readonly tables: Table[];
  private pending: number[] = [];

  constructor(extra: readonly TableSpec[] = []) {
    const specs = BUILTIN.concat(extra);
    const seen: string[] = [];
    this.tables = [];
    for (const spec of specs) {
      if (spec.id.length === 0) throw new Error('table id');
      if (!Number.isInteger(spec.fieldCount) || spec.fieldCount <= 0) throw new Error('table width');
      for (const id of seen) {
        if (id === spec.id) throw new Error(`duplicate table ${spec.id}`);
      }
      seen.push(spec.id);
      this.tables.push({ id: spec.id, fieldCount: spec.fieldCount, data: new Int32Array(0) });
    }
  }

  alloc(kind: EntityKind): EntityId {
    const code = ENTITY_KIND[kind];
    const id = this.allocator.alloc();
    this.syncTables();
    const index = (id as number) & 0xffff;
    for (const table of this.tables) this.clearRow(table, index);
    this.writeRow(this.table('kind'), index, [code]);
    return id;
  }

  /** Marks the entity dead at cleanup. It stays live until flushDespawns. */
  despawn(id: EntityId): void {
    if (!this.allocator.isLive(id)) return;
    const packed = id as number;
    for (const pending of this.pending) {
      if (pending === packed) return;
    }
    this.pending.push(packed);
  }

  flushDespawns(): void {
    const ids = this.pending.slice().sort((a, b) => (a & 0xffff) - (b & 0xffff));
    this.pending = [];
    for (const packed of ids) {
      if (this.allocator.isLive(packed as EntityId)) this.allocator.free(packed as EntityId);
    }
  }

  isLive(id: EntityId): boolean {
    return this.allocator.isLive(id);
  }

  /** Live ids in ascending entity index. */
  liveIds(): EntityId[] {
    const out: EntityId[] = [];
    const n = this.allocator.slotCount;
    for (let i = 0; i < n; i++) {
      if (this.allocator.isLiveIndex(i)) out.push(this.allocator.idAt(i));
    }
    return out;
  }

  setPosition(id: EntityId, x: Fx, y: Fx): void {
    this.setFields(id, 'position', [x as number, y as number]);
  }

  position(id: EntityId): { x: Fx; y: Fx } {
    const fields = this.getFields(id, 'position');
    return { x: fxRaw(fields[0]!), y: fxRaw(fields[1]!) };
  }

  setHeading(id: EntityId, heading: Angle16): void {
    this.setFields(id, 'heading', [heading as number]);
  }

  heading(id: EntityId): Angle16 {
    return angle16(this.getFields(id, 'heading')[0]!);
  }

  setFields(id: EntityId, tableId: string, values: ArrayLike<number>): void {
    this.requireLive(id);
    const table = this.table(tableId);
    if (values.length !== table.fieldCount) throw new Error(`width of ${tableId}`);
    this.writeRow(table, (id as number) & 0xffff, values);
  }

  getFields(id: EntityId, tableId: string): number[] {
    this.requireLive(id);
    const table = this.table(tableId);
    const index = (id as number) & 0xffff;
    const base = index * table.fieldCount;
    const out: number[] = [];
    for (let f = 0; f < table.fieldCount; f++) out.push(table.data[base + f]!);
    return out;
  }

  writeState(buf: ByteBuf): void {
    const cap = this.allocator.capture();
    buf.u32(cap.generations.length);
    for (let i = 0; i < cap.generations.length; i++) {
      buf.u32(cap.generations[i]!);
      buf.u32(cap.live[i]!);
      buf.u32(cap.retired[i]!);
    }
    const pending = this.pending.slice().sort((a, b) => (a & 0xffff) - (b & 0xffff));
    buf.u32(pending.length);
    for (const id of pending) buf.u32(id);
    buf.u32(this.tables.length);
    for (const table of this.tables) {
      buf.u32(table.id.length);
      buf.ascii(table.id);
      buf.u32(table.fieldCount);
      const rows: number[] = [];
      for (let i = 0; i < this.allocator.slotCount; i++) {
        if (this.allocator.isLiveIndex(i)) rows.push(i);
      }
      buf.u32(rows.length);
      for (const index of rows) {
        buf.u32(this.allocator.idAt(index) as number);
        const base = index * table.fieldCount;
        for (let f = 0; f < table.fieldCount; f++) buf.i32(table.data[base + f]!);
      }
    }
  }

  capture(): WorldSnap {
    const cap = this.allocator.capture();
    const tables: TableSnap[] = [];
    for (const table of this.tables) {
      const data: number[] = [];
      for (let i = 0; i < table.data.length; i++) data.push(table.data[i]!);
      tables.push({ id: table.id, fieldCount: table.fieldCount, data });
    }
    return {
      slotCount: cap.generations.length,
      generations: cap.generations,
      live: cap.live,
      retired: cap.retired,
      pendingDespawn: this.pending.slice(),
      tables,
    };
  }

  restore(snap: WorldSnap): void {
    if (snap.tables.length !== this.tables.length) throw new Error('table count');
    for (let i = 0; i < this.tables.length; i++) {
      const got = snap.tables[i]!;
      const expect = this.tables[i]!;
      if (got.id !== expect.id || got.fieldCount !== expect.fieldCount) throw new Error('table shape');
    }
    this.allocator.restore(snap.slotCount, snap.generations, snap.live, snap.retired);
    this.pending = snap.pendingDespawn.slice();
    this.syncTables();
    for (let i = 0; i < this.tables.length; i++) {
      const src = snap.tables[i]!.data;
      const dst = this.tables[i]!.data;
      if (src.length !== dst.length) throw new Error('table data');
      for (let k = 0; k < src.length; k++) dst[k] = src[k]!;
    }
  }

  private requireLive(id: EntityId): void {
    if (!this.allocator.isLive(id)) throw new Error('dead entity');
  }

  private table(id: string): Table {
    for (const table of this.tables) {
      if (table.id === id) return table;
    }
    throw new Error(`no table ${id}`);
  }

  private syncTables(): void {
    const slots = this.allocator.slotCount;
    for (const table of this.tables) {
      const need = slots * table.fieldCount;
      if (table.data.length === need) continue;
      const next = new Int32Array(need);
      const copy = table.data.length < need ? table.data.length : need;
      for (let i = 0; i < copy; i++) next[i] = table.data[i]!;
      table.data = next;
    }
  }

  private clearRow(table: Table, index: number): void {
    const base = index * table.fieldCount;
    for (let f = 0; f < table.fieldCount; f++) table.data[base + f] = 0;
  }

  private writeRow(table: Table, index: number, values: ArrayLike<number>): void {
    const base = index * table.fieldCount;
    for (let f = 0; f < table.fieldCount; f++) table.data[base + f] = values[f]! | 0;
  }
}
