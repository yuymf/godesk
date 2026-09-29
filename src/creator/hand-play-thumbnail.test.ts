import { describe, expect, it } from "vitest";
import { handPlayStartingBoardThumbnailDataUrl } from "./hand-play-thumbnail";

describe("hand-play thumbnail", () => {
  it("emits a deterministic SVG data URL", () => {
    const a = handPlayStartingBoardThumbnailDataUrl();
    const b = handPlayStartingBoardThumbnailDataUrl();
    expect(a).toBe(b);
    expect(a.startsWith("data:image/svg+xml")).toBe(true);
  });
});
