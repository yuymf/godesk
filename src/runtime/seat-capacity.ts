/**
 * Shared seat-capacity helpers (T019).
 * Kernels declare {min,max}; NL / participants are clamped into range.
 * Generic — no sample IP special-cases.
 */

export type SeatCapacity = { readonly min: number; readonly max: number };

export const SEAT_CAPACITY = {
  "hex-settlement-v1": { min: 2, max: 4 },
  "gem-engine-v1": { min: 2, max: 4 },
  "pattern-draft-v1": { min: 2, max: 4 },
  "network-route-v1": { min: 2, max: 4 },
  "auction-bidding-v1-gallery": { min: 2, max: 5 },
} as const;

export type SeatCapableKernel = keyof typeof SEAT_CAPACITY;

export function clampSeatCount(
  n: number,
  capacity: SeatCapacity,
): number {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return capacity.min;
  return Math.max(capacity.min, Math.min(capacity.max, n));
}

/**
 * Parse ideal seat count from rulebook NL.
 * For ranges like「2–4」「3-5人」, prefer the **upper** bound (demonstrate multi-seat).
 */
export function parseSeatCountFromIdea(
  idea: string,
  capacity: SeatCapacity,
): number | null {
  const range = idea.match(
    /(\d+)\s*[-–—－至到]\s*(\d+)\s*(?:人|理想|players?|席|位)?/i,
  );
  if (range) {
    const hi = Math.max(Number(range[1]), Number(range[2]));
    return clampSeatCount(hi, capacity);
  }
  const single = idea.match(
    /(?:人数|玩家|席位)[：:\s]*(\d+)|(\d+)\s*(?:人|玩家|players?|席)/i,
  );
  if (single) {
    const n = Number(single[1] || single[2]);
    return clampSeatCount(n, capacity);
  }
  return null;
}

/** Resolve seats from idea, then participants fallback. */
export function resolveSeatCount(input: {
  idea: string;
  capacity: SeatCapacity;
  participantsDefault?: number;
  participantsMax?: number;
  participantsMin?: number;
}): number {
  const fromIdea = parseSeatCountFromIdea(input.idea, input.capacity);
  if (fromIdea !== null) return fromIdea;
  const cand =
    input.participantsMax ??
    input.participantsDefault ??
    input.participantsMin ??
    input.capacity.min;
  return clampSeatCount(cand, input.capacity);
}

export function nextSeatId(active: number, playerCount: number): number {
  return ((active % playerCount) + 1) % playerCount;
}

export function makeSeatArray<T>(n: number, factory: (index: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => factory(i));
}

/** Highest unique score wins; ties → null. */
export function winnerByHighestScore(scores: readonly number[]): number | null {
  if (!scores.length) return null;
  let best = -Infinity;
  const winners: number[] = [];
  scores.forEach((s, i) => {
    if (s > best) {
      best = s;
      winners.length = 0;
      winners.push(i);
    } else if (s === best) {
      winners.push(i);
    }
  });
  return winners.length === 1 ? winners[0]! : null;
}

/** Classic gem bank sizes by seat count (generic scaling). */
export function gemBankPerBasicForSeats(seats: number): number {
  if (seats <= 2) return 4;
  if (seats === 3) return 5;
  return 7;
}

/** Pattern factories ≈ 2N+1 (generic table scaling). */
export function patternFactoryCountForSeats(seats: number): number {
  return Math.max(5, seats * 2 + 1);
}
