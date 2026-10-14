import { describe, expect, it } from "vitest";
import { resolveSealedBids, splitBrokerageAward, splitNegotiatedBrokerage } from "./brokerage";

describe("brokerage shared (T023)", () => {
  it("splits second-place cut when enabled", () => {
    const s = splitBrokerageAward({
      price: 10,
      seller: 0,
      winner: 1,
      second: 2,
      enabled: true,
      cutBps: 2000,
      playerCount: 3,
    });
    expect(s).toEqual({ toSeller: 8, toBroker: 2, brokerSeat: 2 });
  });

  it("resolves sealed bids with seat-order tiebreak", () => {
    const r = resolveSealedBids([5, 8, 8], [0, 1, 2]);
    expect(r?.winner).toBe(1);
    expect(r?.second).toBe(2);
  });
});

describe("splitNegotiatedBrokerage (T024)", () => {
  it("pays an explicit broker seat a per-deal cut (not second-place award-cut)", () => {
    const split = splitNegotiatedBrokerage({
      price: 100,
      seller: 0,
      winner: 1,
      brokerSeat: 2,
      cutBps: 1500,
    });
    expect(split.brokerSeat).toBe(2);
    expect(split.toBroker).toBe(15);
    expect(split.toSeller).toBe(85);
  });

  it("rejects broker equal to winner or seller", () => {
    expect(
      splitNegotiatedBrokerage({
        price: 100,
        seller: 0,
        winner: 1,
        brokerSeat: 1,
        cutBps: 2000,
      }).toBroker,
    ).toBe(0);
  });
});
