import { describe, expect, it } from "vitest";
import { handPlayStartingBoardThumbnailDataUrl } from "./hand-play-thumbnail";

describe("hand-play thumbnail", () => {
  it("emits a deterministic SVG data URL", () => {
    const a = handPlayStartingBoardThumbnailDataUrl();
    const b = handPlayStartingBoardThumbnailDataUrl();
    expect(a).toBe(b);
    expect(a.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("renders a felt table with a card fan (not hex/disc/network cues)", () => {
    const decoded = decodeURIComponent(handPlayStartingBoardThumbnailDataUrl());
    expect(decoded.includes("<svg")).toBe(true);
    expect(decoded.includes("hpFelt")).toBe(true);
    expect(decoded.includes("hpCardFace")).toBe(true);
    expect(decoded.includes("<rect")).toBe(true);
    expect(decoded.includes("<circle")).toBe(true);
    // Card face values in the fan
    expect(decoded.includes(">5<")).toBe(true);
    expect(decoded.includes(">3<")).toBe(true);
    // Distinct from othello green grid / hexIsland polygons / network edge lines
    expect(decoded.includes("polygon")).toBe(false);
    expect(decoded.includes("<line ")).toBe(false);
    expect(decoded.includes("role=\"img\"")).toBe(true);
  });
});
