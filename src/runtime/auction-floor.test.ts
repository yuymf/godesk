import { describe, expect, it } from "vitest";
import {
  createLiveFloorLot,
  passOnLiveLot,
  raiseOnLiveLot,
  setLiveLotBrokerTerms,
} from "./auction-floor";

describe("auction-floor live multi-lot (T024)", () => {
  it("allows two lots open and settles independently", () => {
    const a = createLiveFloorLot({
      lotId: "A",
      seller: 0,
      reserve: 5,
      playerCount: 3,
      payload: { name: "lotA" },
      brokerSeat: 2,
      brokerCutBps: 1500,
    });
    const b = createLiveFloorLot({
      lotId: "B",
      seller: 1,
      reserve: 4,
      playerCount: 3,
      payload: { name: "lotB" },
    });
    expect(raiseOnLiveLot(a, 1, 6, 50)).toBe(true);
    expect(raiseOnLiveLot(b, 0, 5, 50)).toBe(true);
    expect(passOnLiveLot(a, 0, 3)).toBe("continue");
    expect(passOnLiveLot(a, 2, 3)).toBe("award");
    expect(a.highBidder).toBe(1);
    expect(passOnLiveLot(b, 1, 3)).toBe("continue");
    expect(passOnLiveLot(b, 2, 3)).toBe("award");
  });

  it("unsold when all non-sellers pass with no bid", () => {
    const lot = createLiveFloorLot({
      lotId: "U",
      seller: 0,
      reserve: 3,
      playerCount: 3,
      payload: null,
    });
    expect(passOnLiveLot(lot, 1, 3)).toBe("continue");
    expect(passOnLiveLot(lot, 2, 3)).toBe("unsold");
  });

  it("set_broker_terms only before first raise", () => {
    const lot = createLiveFloorLot({
      lotId: "T",
      seller: 0,
      reserve: 5,
      playerCount: 3,
      payload: null,
    });
    expect(setLiveLotBrokerTerms(lot, 2, 2000, 3)).toBe(true);
    expect(lot.brokerSeat).toBe(2);
    expect(lot.brokerCutBps).toBe(2000);
    raiseOnLiveLot(lot, 1, 6, 40);
    expect(setLiveLotBrokerTerms(lot, 2, 1000, 3)).toBe(false);
  });
});
