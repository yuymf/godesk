/**
 * Determinism harness — injectable RNG (G3D-HARNESS).
 *
 * GoDesk's render layer used `Math.random` directly in four modules. Every one of
 * those call sites now goes through `harnessRandom()`. When no seed is installed
 * (i.e. every normal player), `harnessRandom()` is `Math.random()` behind one
 * boolean branch — behaviour is byte-for-byte unchanged.
 *
 * `?harness=1&seed=N` installs a mulberry32 stream at MODULE EVALUATION TIME,
 * before any texture / geometry is built, so two page loads with the same seed
 * generate the same procedural noise. `setSeed()` on the harness API re-seeds
 * the live stream at runtime.
 *
 * Deliberately NOT wired to this stream (see docs/harness/deterministic-harness.md):
 *  - motion.ts `precomputeDiceTumble` — already keyed by its own deterministic
 *    diceSeedRef (incrementing), and its curve must stay independent of scene RNG.
 *  - terrain-props.ts / island.ts — already per-tile `mulberry32(hash(q,r))`;
 *    routing them through a global stream would destroy spatial stability.
 *  - three.js / React internals, crypto.randomUUID, Date.now() session ids —
 *    outside the render state that digest() and the pixel gate observe.
 */

export type HarnessRngState = {
  seeded: boolean;
  seed: number | null;
  draws: number;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let activeSeed: number | null = null;
let stream: (() => number) | null = null;
let draws = 0;

/** The one RNG call site every harvested module uses. */
export function harnessRandom(): number {
  if (stream) {
    draws += 1;
    return stream();
  }
  return Math.random();
}

/** Fresh sequence from `seed` — does not consume or disturb the live stream. */
export function seededSequence(seed: number, count: number): number[] {
  const next = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push(next());
  return out;
}

/** Consume `count` values from the LIVE stream (used by `randomSequence`). */
export function consumeSequence(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push(harnessRandom());
  return out;
}

export function setHarnessSeed(seed: number): void {
  const normalized = Math.trunc(seed) >>> 0;
  activeSeed = normalized;
  stream = mulberry32(normalized);
  draws = 0;
}

export function clearHarnessSeed(): void {
  activeSeed = null;
  stream = null;
  draws = 0;
}

export function harnessRngState(): HarnessRngState {
  return { seeded: stream !== null, seed: activeSeed, draws };
}

/** Deterministic digest of a seed's first 32 values (no wall-clock, no streams). */
export function seedFingerprint(seed: number | null): string {
  if (seed === null) return "unseeded";
  // FNV-1a over the decimal string of the first 32 seeded values.
  let hash = 0x811c9dc5;
  const src = seededSequence(seed, 32).map((v) => v.toFixed(9)).join(",");
  for (let i = 0; i < src.length; i += 1) {
    hash ^= src.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Boot-time seeding must happen before any render module builds procedural data.
// This module is imported by those modules, so its top level runs first.
if (typeof location !== "undefined") {
  try {
    const params = new URLSearchParams(location.search);
    const harness = params.get("harness");
    if (harness === "1" || harness === "true") {
      const raw = params.get("seed");
      if (raw !== null && raw !== "" && Number.isFinite(Number(raw))) {
        setHarnessSeed(Number(raw));
      }
    }
  } catch {
    /* non-browser / malformed search: stay on Math.random */
  }
}
