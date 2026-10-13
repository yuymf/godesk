/**
 * Combat playback clock shared by the kernel (server deadline) and the renderer (replay).
 * The prep countdown starts only after the replay finishes, so both sides must agree on
 * the replay length. Pure function of the combat log → deterministic on replay.
 */
export const REPLAY_LEAD_MS = 700;
export const REPLAY_TAIL_MS = 1200;
export const HIT_DELAY_MS = 360;
const TARGET_TOTAL_MS = 10_000;

/** Strike spacing so a fight lasts ~8–15s (short fights floor at 1.5s per strike). */
export function strikeStep(strikes: number): number {
  return Math.round(Math.min(1500, Math.max(180, TARGET_TOTAL_MS / Math.max(1, strikes))));
}

type LogEntry = { kind?: unknown };

/** Same event times as the renderer's buildTimeline → its durationMs. */
export function combatReplayDurationMs(log: readonly LogEntry[]): number {
  const step = strikeStep(log.filter((e) => e.kind === "strike").length);
  let t = REPLAY_LEAD_MS;
  let lastHit = t;
  let last = 0;
  let any = false;
  for (const e of log) {
    if (e.kind === "strike") {
      lastHit = t + HIT_DELAY_MS;
      last = Math.max(last, lastHit);
      t += step;
      any = true;
    } else if (e.kind === "heal") {
      last = Math.max(last, Math.max(t - Math.floor(step / 2), lastHit + 40));
      any = true;
    } else if (e.kind === "trait_trigger") {
      last = Math.max(last, Math.max(REPLAY_LEAD_MS - 200, lastHit));
      any = true;
    } else if (e.kind === "unit_down") {
      last = Math.max(last, lastHit + 60);
      any = true;
    } else if (e.kind === "combat_end") {
      last = Math.max(last, lastHit + 500);
      any = true;
    }
  }
  return (any ? last : 0) + REPLAY_TAIL_MS;
}
