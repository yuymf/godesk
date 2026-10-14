/**
 * Shared multi-party brokerage helpers (T020 / T023).
 * Generic award-cut: winner pays `price`; optional second seat takes a cut;
 * remainder goes to seller. No sample IP special-cases.
 */

export type BrokerageSplit = {
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
