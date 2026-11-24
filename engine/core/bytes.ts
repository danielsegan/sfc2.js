/** Little-endian byte helpers. Sim hashing and the command codec share these. */

export function writeU32(buf: Uint8Array, offset: number, value: number): void {
  const v = value >>> 0;
  buf[offset] = v & 0xff;
  buf[offset + 1] = (v >>> 8) & 0xff;
  buf[offset + 2] = (v >>> 16) & 0xff;
  buf[offset + 3] = (v >>> 24) & 0xff;
}

export function readU32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

export function writeU16(buf: Uint8Array, offset: number, value: number): void {
  const v = value & 0xffff;
  buf[offset] = v & 0xff;
  buf[offset + 1] = (v >>> 8) & 0xff;
}

export function readU16(buf: Uint8Array, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8)) & 0xffff;
}

export class ByteBuf {
  private readonly parts: number[] = [];

  u8(value: number): void {
    this.parts.push(value & 0xff);
  }

  u32(value: number): void {
    const v = value >>> 0;
    this.parts.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  }

  i32(value: number): void {
    this.u32(value | 0);
  }

  bytes(src: ArrayLike<number>): void {
    for (let i = 0; i < src.length; i++) this.parts.push(src[i]! & 0xff);
  }

  ascii(text: string): void {
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c > 0x7f) throw new Error('sim bytes are ASCII');
      this.parts.push(c);
    }
  }

  get length(): number {
    return this.parts.length;
  }

  toUint8(): Uint8Array {
    const out = new Uint8Array(this.parts.length);
    for (let i = 0; i < this.parts.length; i++) out[i] = this.parts[i]!;
    return out;
  }
}
