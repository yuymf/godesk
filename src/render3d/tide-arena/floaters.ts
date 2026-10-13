/**
 * Floating combat numbers: stack vertically per cell (never overlap, never cover the
 * HP bar). Damage = coral/red, heal = green. Pure — Step 2 replay reuses this.
 */
export type FloaterEvent = { uid: string; amount: number; kind: "damage" | "heal" };
export type StackedFloater = FloaterEvent & { text: string; slot: number; offsetPx: number };

export const FLOATER_LINE_PX = 18;
/** Clear gap above the HP bar anchor so slot 0 never touches the bar. */
export const FLOATER_BASE_PX = 14;

export function stackFloaters(events: readonly FloaterEvent[], maxPerCell = 3): StackedFloater[] {
  const perUid = new Map<string, FloaterEvent[]>();
  for (const event of events) {
    const list = perUid.get(event.uid) ?? [];
    list.push(event);
    perUid.set(event.uid, list);
  }
  const out: StackedFloater[] = [];
  for (const list of perUid.values()) {
    // Most recent numbers win; the newest sits lowest (slot 0), older ones stack upward.
    const recent = list.slice(-maxPerCell).reverse();
    recent.forEach((event, slot) => {
      out.push({
        ...event,
        text: `${event.kind === "heal" ? "+" : "-"}${event.amount}`,
        slot,
        offsetPx: FLOATER_BASE_PX + slot * FLOATER_LINE_PX,
      });
    });
  }
  return out;
}

type LogEntry = Record<string, unknown>;

/** Combat log → floater events + final HP per uid (for HP bars after the clash). */
export function combatDigest(log: readonly LogEntry[]): { floaters: FloaterEvent[]; hp: Map<string, number> } {
  const floaters: FloaterEvent[] = [];
  const hp = new Map<string, number>();
  for (const entry of log) {
    if (entry.kind === "strike" && typeof entry.targetUid === "string" && typeof entry.damage === "number") {
      floaters.push({ uid: entry.targetUid, amount: entry.damage, kind: "damage" });
      if (typeof entry.targetHp === "number") hp.set(entry.targetUid, entry.targetHp);
    } else if (entry.kind === "heal" && typeof entry.uid === "string" && typeof entry.amount === "number") {
      floaters.push({ uid: entry.uid, amount: entry.amount, kind: "heal" });
    }
  }
  return { floaters, hp };
}
