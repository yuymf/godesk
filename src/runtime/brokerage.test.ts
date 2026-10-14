import { describe, expect, it } from "vitest";
import { resolveSealedBids, splitBrokerageAward } from "./brokerage";

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
