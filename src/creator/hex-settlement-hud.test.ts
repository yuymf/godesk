import { describe, expect, it } from "vitest";
import { formatLastAction } from "./HexSettlementBoard";

describe("formatLastAction", () => {
  it("localizes known Kernel action ids for zh HUD", () => {
    expect(formatLastAction("place_road", "zh")).toBe("铺设栈道");
    expect(formatLastAction("place_settlement", "zh")).toBe("建造渔村");
    expect(formatLastAction("place_city", "zh")).toBe("升级港镇");
    expect(formatLastAction("move_robber", "zh")).toBe("移动雾灯");
    expect(formatLastAction("roll_dice", "zh")).toBe("掷骰");
  });

  it("never echoes raw snake_case ids for known actions", () => {
    for (const id of [
      "place_road",
      "place_settlement",
      "place_city",
      "move_robber",
      "end_turn",
      "buy_dev",
    ]) {
      const label = formatLastAction(id, "zh");
      expect(label).not.toMatch(/_/);
      expect(label).not.toBe(id);
    }
  });

  it("uses noLast for null/unknown", () => {
    expect(formatLastAction(null, "zh")).toBe("尚无行动");
    expect(formatLastAction("totally_unknown_action", "zh")).toBe("尚无行动");
  });
});
