/**
 * Tide Arena / 潮阵 — combat replay timeline (pure, presentational).
 * The worker's append-only combat log → timed events + human-readable log lines.
 * Authority stays on the worker: the timeline only re-times what already happened,
 * and its final HP map equals combatDigest(log).hp (the resolved state).
 */
import { floaterText } from "./floaters";
import { HIT_DELAY_MS, REPLAY_LEAD_MS, REPLAY_TAIL_MS, strikeStep } from "../../runtime/adapters/combat-playback";
export { HIT_DELAY_MS, REPLAY_LEAD_MS, REPLAY_TAIL_MS, strikeStep };

export const RANGED_UNITS: ReadonlySet<string> = new Set([
  "archer",
  "witch",
  "spirit",
  "anemone",
  "priest",
  "lantern",
]);
/** Projectile flight / lunge peak: the hit lands this long after the swing starts. */
export const DEATH_FADE_MS = 500;

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
export type ReplayHeal = {
  kind: "heal";
  t: number;
  uid: string;
  amount: number;
  targetHp: number;
};
export type ReplayTrait = {
  kind: "trait";
  t: number;
  trait: string;
  label: string;
  detail?: string;
};
export type ReplayDown = { kind: "down"; t: number; uid: string };
export type ReplayEnd = { kind: "end"; t: number; winnerSeat: number | null; damageToLoser: number };
export type ReplayVfx = {
  kind: "vfx";
  t: number;
  preset: string;
  atUid?: string;
  fromUid?: string;
  toUid?: string;
  amount?: number;
};
export type ReplayEvent = ReplayStrike | ReplayHeal | ReplayTrait | ReplayDown | ReplayVfx | ReplayEnd;
export type ReplayLine = {
  t: number;
  stamp: string;
  text: string;
  value: string | null;
  kind: "strike" | "heal" | "trait" | "down" | "vfx" | "end";
};
export type Timeline = { events: ReplayEvent[]; lines: ReplayLine[]; durationMs: number; finalHp: Map<string, number> };

type LogEntry = Record<string, unknown>;

export function stamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
      lines.push({
        t: hitT,
        stamp: stamp(hitT),
        text: `${name(attackerUid)} ${ranged ? "射击" : "攻击"} ${name(targetUid)} ${value}`,
        value,
        kind: "strike",
      });
      lastHit = hitT;
      t += step;
    } else if (e.kind === "heal") {
      const uid = String(e.uid);
      const amount = Number(e.amount);
      const healT = Math.max(t - Math.floor(step / 2), lastHit + 40);
      events.push({ kind: "heal", t: healT, uid, amount, targetHp: Number(e.targetHp) });
      if (typeof e.targetHp === "number") finalHp.set(uid, Number(e.targetHp));
      const value = floaterText({ kind: "heal", amount });
      lines.push({
        t: healT,
        stamp: stamp(healT),
        text: `${name(uid)} 恢复 ${value}`,
        value,
        kind: "heal",
      });
    } else if (e.kind === "vfx") {
      const vfxT = Math.max(t - Math.floor(step / 3), lastHit);
      events.push({
        kind: "vfx",
        t: vfxT,
        preset: String(e.preset ?? "hit_particles"),
        atUid: e.atUid ? String(e.atUid) : undefined,
        fromUid: e.fromUid ? String(e.fromUid) : undefined,
        toUid: e.toUid ? String(e.toUid) : undefined,
        amount: typeof e.amount === "number" ? e.amount : undefined,
      });
      lines.push({
        t: vfxT,
        stamp: stamp(vfxT),
        text: `特效 ${String(e.preset ?? "")}`,
        value: null,
        kind: "vfx",
      });
    } else if (e.kind === "trait_trigger") {
      const traitT = Math.max(REPLAY_LEAD_MS - 200, lastHit);
      const label = String(e.label ?? e.trait ?? "羁绊");
      const detail = e.detail ? String(e.detail) : "";
      events.push({
        kind: "trait",
        t: traitT,
        trait: String(e.trait ?? ""),
        label,
        detail: detail || undefined,
      });
      lines.push({
        t: traitT,
        stamp: stamp(traitT),
        text: detail ? `【${label}】${detail}` : `【${label}】触发`,
        value: null,
        kind: "trait",
      });
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
  const last = events.length
    ? Math.max(...events.map((e) => (e.kind === "strike" ? e.hitT : e.t)))
    : 0;
  return { events, lines, durationMs: last + REPLAY_TAIL_MS, finalHp };
}

/** HP per uid as of replay time `ms` (hits land at hitT; heals at t). */
export function hpAt(timeline: Timeline, ms: number, out: Map<string, number> = new Map()): Map<string, number> {
  out.clear();
  for (const e of timeline.events) {
    if (e.kind === "strike" && e.hitT <= ms) out.set(e.targetUid, e.targetHp);
    if (e.kind === "heal" && e.t <= ms) out.set(e.uid, e.targetHp);
  }
  return out;
}
