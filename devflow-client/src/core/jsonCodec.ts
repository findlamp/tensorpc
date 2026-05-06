/** Mirrors tensorpc.core.core_io.JSON_INDEX_KEY */
export const JSON_INDEX_KEY = "__jsonarray_index";

/** ARRAY bit in tensorpc JsonNodeSpecialFlags */
const FLAG_ARRAY = 0x1;

type DTypeSpec = {
  bytes: number;
  create: (count: number) => ArrayBufferView;
};

/** tensorpc JSON-array dtype code → TypedArray constructor */
const DTYPE_TO_CONSTRUCTOR: Record<number, DTypeSpec> = {
  0: { bytes: 4, create: (n) => new Float32Array(n) },
  1: { bytes: 4, create: (n) => new Int32Array(n) },
  2: { bytes: 2, create: (n) => new Int16Array(n) },
  3: { bytes: 1, create: (n) => new Int8Array(n) },
  4: { bytes: 8, create: (n) => new Float64Array(n) },
  5: { bytes: 1, create: (n) => new Uint8Array(n) }, // bool stored as uint8 in buffer
  6: { bytes: 1, create: (n) => new Uint8Array(n) },
  7: { bytes: 2, create: (n) => new Uint16Array(n) }, // float16 display only
  8: { bytes: 8, create: (n) => new BigInt64Array(n) },
  9: { bytes: 2, create: (n) => new Uint16Array(n) },
  10: { bytes: 4, create: (n) => new Uint32Array(n) },
  11: { bytes: 8, create: (n) => new BigUint64Array(n) },
};

const BYTES_JSONARRAY_CODE = 100;

function isJsonIndex(v: unknown): v is Record<string, [unknown, number]> {
  return (
    typeof v === "object" &&
    v !== null &&
    JSON_INDEX_KEY in v &&
    Array.isArray((v as Record<string, unknown>)[JSON_INDEX_KEY])
  );
}

/**
 * Rebuild RPC/event payload from extracted binary chunks + skeleton.
 * Supports the common cases used by tensorpc layout (plain JSON, ndarray slots).
 */
export function putArraysToData(
  arrays: ArrayBufferView[] | Uint8Array[],
  skeleton: unknown,
): unknown {
  if (Array.isArray(skeleton)) {
    const out: unknown[] = new Array(skeleton.length);
    for (let i = 0; i < skeleton.length; i++) {
      out[i] = putArraysToData(arrays, skeleton[i]);
    }
    return out;
  }
  if (skeleton !== null && typeof skeleton === "object") {
    if (isJsonIndex(skeleton)) {
      const pair = skeleton[JSON_INDEX_KEY]!;
      const inner = pair[0]!;
      const flag = pair[1]!;
      if (flag & FLAG_ARRAY) {
        return arrays[inner as number];
      }
      return putArraysToData(arrays, inner);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(skeleton)) {
      out[k] = putArraysToData(arrays, v);
    }
    return out;
  }
  return skeleton;
}

export type MetaEntry = [number, number[]];

/** Parse `Header.data` for Event/RPC bodies (not QueryServiceIds). */
export function parseSkeletonData(dataStr: string): {
  meta: MetaEntry[];
  skeleton: unknown;
} {
  const parsed = JSON.parse(dataStr) as unknown[];
  if (
    parsed.length === 3 &&
    typeof parsed[0] === "number" &&
    Array.isArray(parsed[1])
  ) {
    return { meta: parsed[1] as MetaEntry[], skeleton: parsed[2] };
  }
  if (parsed.length === 2) {
    return { meta: parsed[0] as MetaEntry[], skeleton: parsed[1] };
  }
  throw new Error(
    `Unexpected tensorpc skeleton JSON (length ${parsed.length})`,
  );
}

export function extractArraysFromBinary(
  meta: MetaEntry[],
  bin: Uint8Array,
): ArrayBufferView[] {
  const arrays: ArrayBufferView[] = [];
  let start = 0;
  for (const [dtypeJarr, shape] of meta) {
    if (
      dtypeJarr === BYTES_JSONARRAY_CODE ||
      dtypeJarr === 102 /* BYTES_JSONARRAY_ARRAYBUFFER_CODE */
    ) {
      const len = shape[0] ?? 0;
      arrays.push(bin.subarray(start, start + len));
      start += len;
      continue;
    }
    const spec = DTYPE_TO_CONSTRUCTOR[dtypeJarr];
    if (!spec) {
      throw new Error(`Unsupported ndarray dtype code ${dtypeJarr}`);
    }
    let count = shape[0] ?? 0;
    for (let i = 1; i < shape.length; i++) {
      count *= shape[i]!;
    }
    const nbytes = count * spec.bytes;
    const buf = bin.subarray(start, start + nbytes);
    start += nbytes;
    const ta = spec.create(count);
    new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength).set(buf);
    arrays.push(ta);
  }
  if (start !== bin.byteLength) {
    console.warn(
      `tensorpc decode: trailing ${bin.byteLength - start} bytes after arrays`,
    );
  }
  return arrays;
}
