/** Known-bad sample. The sim linter must report every rule from this file. */
export async function violations(a: number, b: number): Promise<number> {
  const now = Date.now() + performance.now();
  setTimeout(() => {}, 0);
  setInterval(() => {}, 0);
  requestAnimationFrame(() => {});
  queueMicrotask(() => {});
  await Promise.resolve(1);
  void fetch('/health');
  const rolled = Math.random() + Math.sin(1) + Math.sqrt(4) + Math.pow(2, 3);
  const wide = BigInt(1) + 1n;
  const parsed = parseFloat('1.5');
  const compared = 'a'.localeCompare('b') + 'a'.toLocaleString();
  const intl = new Intl.NumberFormat();
  const floats = new Float64Array(1);
  const narrow = new Float32Array(1);
  const quotient = a / b;
  const power = a ** b;
  const half = 1.5;
  const obj: Record<string, number> = { a: 1 };
  let fromIn = 0;
  for (const key in obj) fromIn += obj[key] ?? 0;
  const keys = Object.keys(obj);
  const values = Object.values(obj);
  const entries = Object.entries(obj);
  const sorted = [3, 1, 2].sort();
  const weak = new WeakMap<object, number>();
  const ref = new WeakRef(obj);
  const registry = new FinalizationRegistry(() => {});
  return (
    now +
    rolled +
    parsed +
    quotient +
    power +
    half +
    fromIn +
    keys.length +
    values.length +
    entries.length +
    sorted.length +
    (floats[0] ?? 0) +
    (narrow[0] ?? 0) +
    Number(wide) +
    compared.length +
    intl.format(1).length +
    (ref.deref() ? 1 : 0) +
    (registry ? 1 : 0) +
    (weak ? 1 : 0)
  );
}
