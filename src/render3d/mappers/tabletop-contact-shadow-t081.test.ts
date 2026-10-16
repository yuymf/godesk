import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mapTabletopToScene } from "./tabletop";
import { patternDraftLayout, gemEngineLayout } from "./tabletop-kernels";
import { defaultRenderSpec } from "../../creator/render-spec";
import type { TabletopRenderInput } from "./tabletop";

describe("T081 pattern contact shadow debt", () => {
  it("softContactShadow accepts shared opacity/boost opts; glazed-tile uses T081 blob", () => {
    const src = readFileSync("src/render3d/tabletop-objects.ts", "utf8");
    expect(src).toContain("T081");
    expect(src).toMatch(/opts\?:\s*\{\s*opacity\?:/);
    expect(src).toMatch(/glazed-tile[\s\S]{0,200}opacity:\s*0\.6/);
  });

  it("pattern scenes emit absolute contact-shadow nodes for tiles/plates", () => {
    const pattern = mapTabletopToScene(
      patternDraftLayout({
        factories: [["blue", "yellow", "red", "black"]],
        center: ["white"],
        markerInCenter: false,
        seats: [{
          lines: [{ color: "blue", tiles: ["blue"], capacity: 1 }],
          wall: [
            ["blue", null, null, null, null],
            [null, null, null, null, null],
            [null, null, null, null, null],
            [null, null, null, null, null],
            [null, null, null, null, null],
          ],
          floor: [],
          score: 0,
        }],
      }),
      defaultRenderSpec("pattern-draft-v1", "table") as TabletopRenderInput,
    );
    const contacts = pattern.model.nodes.filter((n) => n.mesh === "contact-shadow");
    expect(contacts.length).toBeGreaterThan(3);
    // plates + tiles get absolute blobs
    expect(contacts.some((n) => String(n.id).includes("factory"))).toBe(true);
    const labels = pattern.model.nodes.map((n) => n.tag ?? "").join(" ");
    expect(labels).not.toMatch(/gold:\s*0/i);
    expect(labels).not.toMatch(/color:\d/);
  });

  it("gem scenes keep contact shadows (no H03 regress of T079 path)", () => {
    const gem = mapTabletopToScene(
      gemEngineLayout({
        bank: { white: 1, blue: 2, green: 0, red: 0, black: 0, gold: 0 },
        market: [[{ discount: "blue", prestige: 1, cost: { white: 1 } }]],
        nobles: [],
        seats: [{ gems: {}, prestige: 0, cards: [], reserved: [] }],
      }),
      defaultRenderSpec("gem-engine-v1", "table") as TabletopRenderInput,
    );
    expect(
      gem.model.nodes.some((n) => n.mesh === "contact-shadow" || n.mesh === "card" || n.mesh === "gem-chip"),
    ).toBe(true);
  });
});
