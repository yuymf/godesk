/**
 * Floating combat numbers: stack vertically per cell (never overlap, never cover the
 * HP bar). Damage = coral/red, heal = green. Pure — Step 2 replay reuses this.
 */
export type FloaterEvent = { uid: string; amount: number; kind: "damage" | "heal" };
type StackedFloater = FloaterEvent & { text: string; slot: number; offsetPx: number };

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
        text: floaterText(event),
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

/** Shared by the floater and the replay log line so their numbers always match. */
export function floaterText(event: { kind: "damage" | "heal"; amount: number }): string {
  return `${event.kind === "heal" ? "+" : "−"}${event.amount}`;
}

/** Approximate floater label box (px) used for screen-space collision. */
const FLOATER_BOX = { w: 46, h: FLOATER_LINE_PX };

/**
 * Greedy de-overlap across cells: anchors are processed bottom-up; a stack whose box
 * collides with an already placed stack is lifted until it clears. Returns extra px per uid.
 */
export function resolveFloaterLift(
  anchors: ReadonlyArray<{ uid: string; x: number; y: number }>,
  byUid: ReadonlyMap<string, ReadonlyArray<{ offsetPx: number }>>,
): Map<string, number> {
  const lift = new Map<string, number>();
  const placed: Array<{ x: number; top: number; bottom: number }> = [];
  const withFloaters = anchors.filter((a) => (byUid.get(a.uid)?.length ?? 0) > 0).sort((a, b) => b.y - a.y);
  for (const a of withFloaters) {
    const list = byUid.get(a.uid)!;
    const lo = Math.min(...list.map((f) => f.offsetPx));
    const hi = Math.max(...list.map((f) => f.offsetPx)) + FLOATER_BOX.h;
    let extra = 0;
    for (let guard = 0; guard < 12; guard += 1) {
      const bottom = a.y - lo - extra;
      const top = a.y - hi - extra;
      const hit = placed.find((p) => Math.abs(p.x - a.x) < FLOATER_BOX.w && top < p.bottom && bottom > p.top);
      if (!hit) break;
      extra += bottom - hit.top + 2;
    }
    lift.set(a.uid, extra);
    placed.push({ x: a.x, top: a.y - hi - extra, bottom: a.y - lo - extra });
  }
  return lift;
}
