/**
 * G3D-08 · coast distance field (Felzenszwalb–Huttenlocher 1D DT × 2).
 * Pure CPU; land = 0, water = Euclidean distance in texel units.
 */
export type CoastSample = { x: number; z: number; radius: number };

const INF = 1e20;

/** 1D squared-distance transform (Felzenszwalb–Huttenlocher). */
export function distanceTransform1D(f: Float64Array, n: number, out: Float64Array): void {
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q += 1) {
    let s =
      (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k -= 1;
      s =
        (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1]! < q) k += 1;
    const d = q - v[k]!;
    out[q] = d * d + f[v[k]!]!;
  }
}

function pointInFlatTopHex(px: number, pz: number, cx: number, cz: number, R: number): boolean {
  const x = Math.abs(px - cx) / R;
  const z = Math.abs(pz - cz) / R;
  // Flat-top hex: |z| ≤ √3/2, |x| + |z|/√3 ≤ 1
  return z <= Math.sqrt(3) * 0.5 + 1e-6 && x + z / Math.sqrt(3) <= 1 + 1e-6;
}

/**
 * Build a 0/1 land mask over a world AABB mapped to a square texture.
 * World X → u, World Z → v; y ignored.
 */
export function buildLandMask(
  size: number,
  halfExtent: number,
  coasts: readonly CoastSample[],
): Uint8Array {
  const mask = new Uint8Array(size * size);
  const cell = (2 * halfExtent) / size;
  // Precompute AABB in texel space for early reject (keeps DT ≤15ms EP-D).
  const boxes = coasts.map((c) => {
    const r = c.radius;
    return {
      c,
      i0: Math.max(0, Math.floor((c.x - r + halfExtent) / cell)),
      i1: Math.min(size - 1, Math.ceil((c.x + r + halfExtent) / cell)),
      j0: Math.max(0, Math.floor((c.z - r + halfExtent) / cell)),
      j1: Math.min(size - 1, Math.ceil((c.z + r + halfExtent) / cell)),
    };
  });
  for (const box of boxes) {
    const { c, i0, i1, j0, j1 } = box;
    for (let j = j0; j <= j1; j += 1) {
      const z = -halfExtent + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i += 1) {
        const x = -halfExtent + (i + 0.5) * cell;
        if (pointInFlatTopHex(x, z, c.x, c.z, c.radius)) {
          mask[j * size + i] = 1;
        }
      }
    }
  }
  return mask;
}

/** Euclidean distance in texels from nearest land pixel (0 on land). */
export function computeCoastDistance(mask: Uint8Array, size: number): Float32Array {
  const n = size * size;
  const f = new Float64Array(n);
  for (let i = 0; i < n; i += 1) f[i] = mask[i] ? 0 : INF;

  const rowIn = new Float64Array(size);
  const rowOut = new Float64Array(size);
  // Columns (vertical pass uses current f as 1D rows along y for each x — FH on each column)
  const colIn = new Float64Array(size);
  const colOut = new Float64Array(size);
  const tmp = new Float64Array(n);

  // Pass 1: along x (rows)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) rowIn[x] = f[y * size + x]!;
    distanceTransform1D(rowIn, size, rowOut);
    for (let x = 0; x < size; x += 1) tmp[y * size + x] = rowOut[x]!;
  }
  // Pass 2: along y (columns)
  const out = new Float32Array(n);
  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) colIn[y] = tmp[y * size + x]!;
    distanceTransform1D(colIn, size, colOut);
    for (let y = 0; y < size; y += 1) out[y * size + x] = Math.sqrt(colOut[y]!);
  }
  return out;
}

export type DistanceFieldResult = {
  size: number;
  halfExtent: number;
  /** Normalized 0..1 distance (0 = land, 1 = far water). */
  data: Float32Array;
  elapsedMs: number;
};

export function buildCoastDistanceField(
  coasts: readonly CoastSample[],
  size: number,
  halfExtent: number,
  maxDistTexels = size * 0.35,
): DistanceFieldResult {
  const t0 = performance.now();
  const mask = buildLandMask(size, halfExtent, coasts);
  const dist = computeCoastDistance(mask, size);
  const data = new Float32Array(size * size);
  const inv = 1 / Math.max(maxDistTexels, 1e-6);
  for (let i = 0; i < dist.length; i += 1) {
    data[i] = Math.min(1, dist[i]! * inv);
  }
  return { size, halfExtent, data, elapsedMs: performance.now() - t0 };
}
