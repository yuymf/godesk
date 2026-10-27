/**
 * Shared multi-party brokerage helpers (T020 / T023 / T024).
 * - award-cut: second seat takes fixed bps of winning price
 * - negotiated: explicit broker seat + per-deal cut (beyond fixed award-cut)
 * No sample IP special-cases.
 */

type BrokerageSplit = {
  toSeller: number;
  toBroker: number;
  brokerSeat: number | null;
};

export function splitBrokerageAward(input: {
  price: number;
  seller: number;
  winner: number;
  second: number | null;
  enabled: boolean;
  cutBps: number;
  playerCount: number;
}): BrokerageSplit {
  const price = Math.max(0, Math.floor(input.price));
  if (
    !input.enabled ||
    input.playerCount < 3 ||
    input.second === null ||
    input.second === input.winner ||
    input.second === input.seller ||
    input.cutBps <= 0
  ) {
    return { toSeller: price, toBroker: 0, brokerSeat: null };
  }
  const cut = Math.floor((price * input.cutBps) / 10000);
  if (cut <= 0 || cut >= price) {
    return { toSeller: price, toBroker: 0, brokerSeat: null };
  }
  return { toSeller: price - cut, toBroker: cut, brokerSeat: input.second };
}

/**
 * Beyond fixed second-place award-cut: seller/table names an explicit broker
 * seat and a per-deal cut in basis points.
 */
export function splitNegotiatedBrokerage(input: {
  price: number;
  seller: number;
  winner: number;
  brokerSeat: number | null;
  cutBps: number;
}): BrokerageSplit {
  const price = Math.max(0, Math.floor(input.price));
  const broker = input.brokerSeat;
  const cutBps = Math.max(0, Math.floor(input.cutBps));
  if (
    broker === null ||
    broker === input.seller ||
    broker === input.winner ||
    cutBps <= 0
  ) {
    return { toSeller: price, toBroker: 0, brokerSeat: null };
  }
  const cut = Math.floor((price * cutBps) / 10000);
  if (cut <= 0 || cut >= price) {
    return { toSeller: price, toBroker: 0, brokerSeat: null };
  }
  return { toSeller: price - cut, toBroker: cut, brokerSeat: broker };
}

/** Highest unique bid wins; ties broken by seatOrder index (lower first). */
export function resolveSealedBids(
  bids: ReadonlyArray<number | null>,
  seatOrder: readonly number[],
): { winner: number; amount: number; second: number | null } | null {
  const cand: Array<{ seat: number; bid: number }> = [];
  bids.forEach((b, seat) => {
    if (typeof b === "number" && b >= 0) cand.push({ seat, bid: b });
  });
  if (!cand.length) return null;
  cand.sort((a, b) => {
    if (b.bid !== a.bid) return b.bid - a.bid;
    return seatOrder.indexOf(a.seat) - seatOrder.indexOf(b.seat);
  });
  const winner = cand[0]!;
  const second = cand.length >= 2 ? cand[1]!.seat : null;
  return { winner: winner.seat, amount: winner.bid, second };
}
