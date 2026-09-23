import { describe, expect, it } from "vitest";
import {
  HARBOR_DOCK_GROUP_KIND,
  HARBOR_LANDMARK_TEST_IDS,
  HARBOR_PRESENTATION_BAR,
} from "./harbor-presentation-bar";
import { HarborVoyageBoard } from "./HarborVoyageBoard";

describe("harbor presentation bar contract (W4-03)", () => {
  it("declares settlecoast as a 2D presentation bar, never a 3D port", () => {
    expect(HARBOR_PRESENTATION_BAR.dimensionality).toBe("2d");
    expect(HARBOR_PRESENTATION_BAR.flagshipExample).toBe("港口十三号");
    expect(HARBOR_PRESENTATION_BAR.visualReference).toBe("settlecoast");
    expect(HARBOR_PRESENTATION_BAR.never).toEqual(
      expect.arrayContaining([
        "WebGL",
        "3D engine",
        "GameFactory-3D",
        "build settlecoast in 3D",
      ]),
    );
  });

  it("exports spectator landmarks for cargo tracks and dock groups", () => {
    expect(HARBOR_LANDMARK_TEST_IDS.board).toBe("harbor-voyage-board");
    expect(HARBOR_LANDMARK_TEST_IDS.cargoTracks).toBe("harbor-cargo-tracks");
    expect(HARBOR_LANDMARK_TEST_IDS.cargoTrack("cedar")).toBe(
      "harbor-cargo-track-cedar",
    );
    expect(HARBOR_LANDMARK_TEST_IDS.dockGroup["港口"]).toBe(
      "harbor-dock-group-port",
    );
    expect(HARBOR_LANDMARK_TEST_IDS.dockGroup["货船"]).toBe(
      "harbor-dock-group-cargo",
    );
    expect(HARBOR_LANDMARK_TEST_IDS.dockGroup["船厂"]).toBe(
      "harbor-dock-group-yard",
    );
    expect(HARBOR_LANDMARK_TEST_IDS.dockGroup["特殊行动"]).toBe(
      "harbor-dock-group-special",
    );
    expect(HARBOR_DOCK_GROUP_KIND["港口"]).toBe("port");
    expect(HarborVoyageBoard).toEqual(expect.any(Function));
  });
});
