/**
 * Tide Arena / 潮阵 — combat replay timeline (pure, presentational).
 * The worker's append-only combat log → timed events + human-readable log lines.
 * Authority stays on the worker: the timeline only re-times what already happened,
 * and its final HP map equals combatDigest(log).hp (the resolved state).
 */
import { floaterText } from "./floaters";

export const RANGED_UNITS: ReadonlySet<string> = new Set(["archer", "witch", "spirit"]);
export const REPLAY_LEAD_MS = 700;
export const REPLAY_TAIL_MS = 1200;
/** Projectile flight / lunge peak: the hit lands this long after the swing starts. */
export const HIT_DELAY_MS = 360;
export const DEATH_FADE_MS = 500;
const TARGET_TOTAL_MS = 10_000;

export type ReplayStrike = {
  kind: "strike";
  t: number;
  hitT: number;
  attackerUid: string;
  targetUid: string;
  damage: number;
  targetHp: number;
  ranged: boolean;
};
export type ReplayDown = { kind: "down"; t: number; uid: string };
export type ReplayEnd = { kind: "end"; t: number; winnerSeat: number | null; damageToLoser: number };
export type ReplayEvent = ReplayStrike | ReplayDown | ReplayEnd;
export type ReplayLine = { t: number; stamp: string; text: string; value: string | null; kind: "strike" | "down" | "end" };
export type Timeline = { events: ReplayEvent[]; lines: ReplayLine[]; durationMs: number; finalHp: Map<string, number> };

type LogEntry = Record<string, unknown>;

export function stamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Strike spacing so a fight lasts ~8–15s (short fights floor at 1.5s per strike). */
export function strikeStep(strikes: number): number {
  return Math.round(Math.min(1500, Math.max(180, TARGET_TOTAL_MS / Math.max(1, strikes))));
}

export function buildTimeline(
  log: readonly LogEntry[],
  unitOf: (uid: string) => { unitId: string; name: string } | undefined,
): Timeline {
  const strikes = log.filter((e) => e.kind === "strike").length;
  const step = strikeStep(strikes);
  const events: ReplayEvent[] = [];
  const lines: ReplayLine[] = [];
  const finalHp = new Map<string, number>();
  let t = REPLAY_LEAD_MS;
  let lastHit = t;
  const name = (uid: unknown) => unitOf(String(uid))?.name ?? "?";
  for (const e of log) {
    if (e.kind === "strike") {
      const attackerUid = String(e.attackerUid);
      const targetUid = String(e.targetUid);
      const damage = Number(e.damage);
      const ranged = RANGED_UNITS.has(unitOf(attackerUid)?.unitId ?? "");
      const hitT = t + HIT_DELAY_MS;
      events.push({ kind: "strike", t, hitT, attackerUid, targetUid, damage, targetHp: Number(e.targetHp), ranged });
      finalHp.set(targetUid, Number(e.targetHp));
      const value = floaterText({ kind: "damage", amount: damage });
      lines.push({ t: hitT, stamp: stamp(hitT), text: `${name(attackerUid)} ${ranged ? "射击" : "攻击"} ${name(targetUid)} ${value}`, value, kind: "strike" });
      lastHit = hitT;
      t += step;
    } else if (e.kind === "unit_down") {
      const downT = lastHit + 60;
      events.push({ kind: "down", t: downT, uid: String(e.uid) });
      lines.push({ t: downT, stamp: stamp(downT), text: `${name(e.uid)} 倒下`, value: null, kind: "down" });
    } else if (e.kind === "combat_end") {
      const endT = lastHit + 500;
      const winnerSeat = e.winnerSeat === null ? null : Number(e.winnerSeat);
      events.push({ kind: "end", t: endT, winnerSeat, damageToLoser: Number(e.damageToLoser) });
      lines.push({
        t: endT,
        stamp: stamp(endT),
        text: winnerSeat === null ? "平局" : `座位 ${winnerSeat} 胜 · 伤害 ${e.damageToLoser}`,
        value: null,
        kind: "end",
      });
    }
  }
  const last = events.length ? Math.max(...events.map((e) => (e.kind === "strike" ? e.hitT : e.t))) : 0;
  return { events, lines, durationMs: last + REPLAY_TAIL_MS, finalHp };
}

/** HP per uid as of replay time `ms` (hits land at hitT). */
export function hpAt(timeline: Timeline, ms: number, out: Map<string, number> = new Map()): Map<string, number> {
  out.clear();
  for (const e of timeline.events) if (e.kind === "strike" && e.hitT <= ms) out.set(e.targetUid, e.targetHp);
  return out;
}
