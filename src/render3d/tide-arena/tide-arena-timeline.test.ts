import { describe, expect, it } from "vitest";
import { autoPlayAutoBattlerGame } from "../../runtime/adapters/auto-battler";
import { combatDigest } from "./floaters";
import { buildTimeline, hpAt, stamp, strikeStep } from "./timeline";

const log = [
  { kind: "combat_start", round: 1 },
  { kind: "strike", attackerUid: "a", targetUid: "b", damage: 18, targetHp: 82 },
  { kind: "strike", attackerUid: "b", targetUid: "a", damage: 70, targetHp: 0 },
  { kind: "unit_down", uid: "a", owner: 0 },
  { kind: "combat_end", winnerSeat: 1, damageToLoser: 3 },
];
const units: Record<string, { unitId: string; name: string }> = { a: { unitId: "archer", name: "飞鱼弓" }, b: { unitId: "whale", name: "鲸盾" } };

describe("tide arena replay timeline", () => {
  it("renders readable, timestamped log lines whose values match the floater text", () => {
    const tl = buildTimeline(log, (uid) => units[uid]);
    expect(tl.lines[0]!.text).toBe("飞鱼弓 射击 鲸盾 −18");
    expect(tl.lines[0]!.value).toBe("−18");
    expect(tl.lines[1]!.text).toBe("鲸盾 攻击 飞鱼弓 −70");
    expect(tl.lines.map((l) => l.kind)).toEqual(["strike", "strike", "down", "end"]);
    expect(stamp(4200)).toBe("0:04");
    expect(tl.lines.every((l, i, a) => i === 0 || l.t >= a[i - 1]!.t)).toBe(true);
  });

  it("ends in exactly the resolved state", () => {
    const { state } = autoPlayAutoBattlerGame(7, 60);
    const real = state.genre.combatLog as unknown as Array<Record<string, unknown>>;
    const tl = buildTimeline(real, () => ({ unitId: "crab", name: "礁蟹" }));
    expect([...hpAt(tl, tl.durationMs)]).toEqual([...combatDigest(real).hp]);
    expect([...tl.finalHp]).toEqual([...combatDigest(real).hp]);
  });

  it("paces fights to roughly 8–15s", () => {
    expect(strikeStep(8) * 8).toBeGreaterThanOrEqual(8000);
    expect(strikeStep(64) * 64).toBeLessThanOrEqual(15_000);
  });
});
