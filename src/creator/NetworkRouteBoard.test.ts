import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NetworkRouteBoard } from "./NetworkRouteBoard";
import { createInitialNetworkRouteSessionSlice } from "./network-route-thumbnail";

describe("NetworkRouteBoard", () => {
  it("renders stable HUD aria regions and link progress", () => {
    const slice = createInitialNetworkRouteSessionSlice();
    const html = renderToStaticMarkup(
      createElement(NetworkRouteBoard, {
        networkRoute: slice,
        activeSeat: 0,
        viewerSeat: 0,
        status: "active",
        enabled: true,
        locale: "zh",
        winnerSeat: null,
      }),
    );
    expect(html).toContain('aria-label="线路网络盘"');
    // desk-stage HUD / drawer chrome (immersive tabletop-first)
    expect(html).toContain("desk-stage-hud");
    expect(html).toContain("轮到你铺线");
    expect(html).toContain("已铺路线");
    expect(html).toContain("北港");
    expect(html).toContain("南站");
    expect(html).toContain("座位 0 未连通");
    expect(html).toContain("座位 1 未连通");
    expect(html).toContain("desk-action-drawer");
  });
});
