import { describe, expect, it } from "vitest";
import { boardWorld, benchWorld, dragAction, legalDrops, slotAt, type SlotRef } from "./layout";
import { combatDigest, FLOATER_BASE_PX, FLOATER_LINE_PX, stackFloaters } from "./floaters";

describe("tide arena layout", () => {
  it("round-trips own cells and bench slots through the ground hit test", () => {
    for (const i of [0, 6, 7, 13]) {
      const p = boardWorld(true, i);
      expect(slotAt(p.x, p.z)).toEqual({ kind: "cell", boardIndex: i });
    }
    const b = benchWorld(4);
    expect(slotAt(b.x, b.z)).toEqual({ kind: "bench", benchIndex: 4 });
    const enemy = boardWorld(false, 0);
    expect(slotAt(enemy.x, enemy.z)).toBeNull(); // enemy half is never a drop target
  });

  it("maps drags to kernel actions and snaps back on illegal drops", () => {
    const empty = () => false;
    expect(dragAction({ kind: "bench", benchIndex: 1 }, { kind: "cell", boardIndex: 9 }, empty))
      .toEqual({ type: "place", payload: { benchIndex: 1, boardIndex: 9 } });
    expect(dragAction({ kind: "cell", boardIndex: 2 }, { kind: "cell", boardIndex: 3 }, empty))
      .toEqual({ type: "move", payload: { from: 2, to: 3 } });
    expect(dragAction({ kind: "cell", boardIndex: 2 }, "sell", empty))
      .toEqual({ type: "sell", payload: { boardIndex: 2 } });
    expect(dragAction({ kind: "cell", boardIndex: 2 }, { kind: "cell", boardIndex: 3 }, () => true)).toBeNull();
    expect(dragAction({ kind: "bench", benchIndex: 0 }, { kind: "bench", benchIndex: 1 }, empty)).toBeNull();
  });

  it("highlights only empty own cells (plus bench when lifting from board)", () => {
    const occupied = (slot: SlotRef) => slot.kind === "cell" && slot.boardIndex === 0;
    expect(legalDrops({ kind: "bench", benchIndex: 0 }, occupied)).toHaveLength(13);
    expect(legalDrops({ kind: "cell", boardIndex: 0 }, occupied)).toHaveLength(13 + 5);
  });
});

describe("floater stacking", () => {
  it("stacks numbers per cell upward, newest lowest, above the HP bar gap", () => {
    const stacked = stackFloaters([
      { uid: "a", amount: 12, kind: "damage" },
      { uid: "a", amount: 15, kind: "heal" },
      { uid: "b", amount: 9, kind: "damage" },
    ]);
    const a = stacked.filter((f) => f.uid === "a");
    expect(a.map((f) => [f.text, f.slot])).toEqual([["+15", 0], ["−12", 1]]);
    expect(a[0]!.offsetPx).toBe(FLOATER_BASE_PX);
    expect(a[1]!.offsetPx).toBe(FLOATER_BASE_PX + FLOATER_LINE_PX);
    expect(stacked.find((f) => f.uid === "b")?.slot).toBe(0);
  });

  it("caps the stack per cell and digests the combat log into final HP", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ uid: "x", amount: i + 1, kind: "damage" as const }));
    expect(stackFloaters(many, 3)).toHaveLength(3);
    const digest = combatDigest([
      { kind: "strike", attackerUid: "p1", targetUid: "p2", damage: 45, targetHp: 505 },
      { kind: "strike", attackerUid: "p2", targetUid: "p1", damage: 70, targetHp: 580 },
    ]);
    expect(digest.hp.get("p2")).toBe(505);
    expect(digest.floaters).toHaveLength(2);
  });
});
