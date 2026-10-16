/**
 * Shared live multi-lot auction floor (T024).
 * Multiple lots may be open concurrently; seats raise/pass in realtime
 * (not only reveal-after-all-commit). Payload is opaque to the floor.
 */

export type LiveFloorLot<TPayload = unknown> = {
  lotId: string;
  seller: number;
  reserve: number;
  /** Starts at max(0, reserve - 1); raises must exceed currentBid. */
  currentBid: number;
  highBidder: number | null;
  /** Cleared on raise; set on pass. */
  passedSinceRaise: boolean[];
  /** Negotiated broker (beyond fixed second-place award-cut). */
  brokerSeat: number | null;
  brokerCutBps: number;
  payload: TPayload;
};

export type FloorSettle = "continue" | "award" | "unsold";

export function createLiveFloorLot<T>(input: {
  lotId: string;
  seller: number;
  reserve: number;
  playerCount: number;
  payload: T;
  brokerSeat?: number | null;
  brokerCutBps?: number;
}): LiveFloorLot<T> {
  const n = Math.max(1, input.playerCount);
  return {
    lotId: input.lotId,
    seller: input.seller,
    reserve: Math.max(0, Math.floor(input.reserve)),
    currentBid: Math.max(0, Math.floor(input.reserve) - 1),
    highBidder: null,
    passedSinceRaise: Array.from({ length: n }, () => false),
    brokerSeat:
      input.brokerSeat === undefined ? null : input.brokerSeat,
    brokerCutBps: Math.max(0, Math.floor(input.brokerCutBps ?? 0)),
    payload: input.payload,
  };
}

export function raiseOnLiveLot(
  lot: LiveFloorLot,
  seat: number,
  amount: number,
  funds: number,
): boolean {
  if (seat === lot.seller) return false;
  if (!Number.isSafeInteger(amount) || amount <= lot.currentBid) return false;
  if (amount > funds) return false;
  lot.currentBid = amount;
  lot.highBidder = seat;
  for (let i = 0; i < lot.passedSinceRaise.length; i += 1) {
    lot.passedSinceRaise[i] = false;
  }
  return true;
}

export function passOnLiveLot(
  lot: LiveFloorLot,
  seat: number,
  playerCount: number,
): FloorSettle {
  if (seat < 0 || seat >= playerCount) return "continue";
  lot.passedSinceRaise[seat] = true;
  if (lot.highBidder !== null) {
    for (let s = 0; s < playerCount; s += 1) {
      if (s === lot.highBidder) continue;
      if (!lot.passedSinceRaise[s]) return "continue";
    }
    return "award";
  }
  for (let s = 0; s < playerCount; s += 1) {
    if (s === lot.seller) continue;
    if (!lot.passedSinceRaise[s]) return "continue";
  }
  return "unsold";
}

export function setLiveLotBrokerTerms(
  lot: LiveFloorLot,
  brokerSeat: number | null,
  cutBps: number,
  playerCount: number,
): boolean {
  if (lot.highBidder !== null) return false;
  if (brokerSeat !== null) {
    if (
      !Number.isInteger(brokerSeat) ||
      brokerSeat < 0 ||
      brokerSeat >= playerCount ||
      brokerSeat === lot.seller
    ) {
      return false;
    }
  }
  const bps = Math.max(0, Math.floor(cutBps));
  if (bps > 9000) return false;
  lot.brokerSeat = brokerSeat;
  lot.brokerCutBps = bps;
  return true;
}

export function suggestRaiseAmounts(
  lot: LiveFloorLot,
  funds: number,
): number[] {
  const min = lot.currentBid + 1;
  if (min > funds) return [];
  const raw = [min, Math.min(funds, min + 2), Math.min(funds, min + 5), funds];
  return raw.filter((a, i, arr) => a >= min && a <= funds && arr.indexOf(a) === i);
}
