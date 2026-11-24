/** Lowercase 8-digit hex for a uint32, including the 0x prefix. */
export function hex32(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}
