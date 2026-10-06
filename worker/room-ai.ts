/**
 * G3D-04b: Room AI seats.
 *
 * A Shared Session may mark seats as AI (`aiSeats`). The Durable Object drives
 * those seats server-side from its alarm: one bot intent per alarm tick, picked
 * by the same `pickBotIntent` that powers `runBotSimulation`, and accepted only
 * through `acceptIntent` (the Executable Kernel stays the sole authority).
 *
 * Exactly-once: the pending AI turn record is written in the same storage
 * transaction as the action that made the AI seat active, and it pins
 * `expectedActions` (the action-log length it was scheduled for). The AI step
 * re-checks that pin and uses a deterministic intentId (`ai_<sequence>`), and
 * deletes the record in the same transaction as the AI action. A DO restart,
 * a duplicate alarm or a reconnect therefore can never double-move.
 */
import type { StoredSharedSession } from "./public-urls";

export const AI_TURN_PREFIX = "ai-turn:";
export const AI_THINK_MS_DEFAULT = 900;
export const AI_THINK_MS_MAX = 5_000;
/** Safety valve: never let one AI seat take more than this many actions in a row. */
export const AI_MAX_CONSECUTIVE_ACTIONS = 200;

export interface AiPendingTurn {
  sessionId: string;
  /** acceptedActions.length at scheduling time; a mismatch means stale. */
  expectedActions: number;
  dueAt: number;
}

export function aiTurnKey(sessionId: string) {
  return `${AI_TURN_PREFIX}${sessionId}`;
}

export function aiIntentId(sequence: number) {
  return `ai_${sequence}`;
}

/** Validate a create-time `aiSeats` option. Returns null when invalid. */
export function normalizeAiSeats(
  value: unknown,
  playerCount: number,
): number[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > playerCount) return null;
  const seats = new Set<number>();
  for (const seat of value) {
    if (!Number.isInteger(seat) || seat < 0 || seat >= playerCount) return null;
    seats.add(seat);
  }
  // At least one human seat must remain; an all-AI Room is a bot simulation.
  if (seats.size >= playerCount) return null;
  return [...seats].sort((a, b) => a - b);
}

export function normalizeAiThinkMs(value: unknown): number | null {
  if (value === undefined) return AI_THINK_MS_DEFAULT;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > AI_THINK_MS_MAX) {
    return null;
  }
  return value as number;
}

export function isAiSeat(room: Pick<StoredSharedSession, "aiSeats">, seat: number) {
  return Boolean(room.aiSeats?.includes(seat));
}

/** The pending AI turn this room needs right now, or null when a human is up. */
export function aiPendingFor(
  room: StoredSharedSession,
  now: number,
): AiPendingTurn | null {
  if (!room.aiSeats?.length || room.state.status !== "active") return null;
  if (!room.aiSeats.includes(room.state.activeSeat)) return null;
  return {
    sessionId: room.id,
    expectedActions: room.acceptedActions.length,
    dueAt: now + (room.aiThinkMs ?? AI_THINK_MS_DEFAULT),
  };
}

/** Count trailing actions taken by `seat` (consecutive-action safety valve). */
export function trailingActionsBySeat(
  room: StoredSharedSession,
  seat: number,
) {
  let count = 0;
  for (let index = room.acceptedActions.length - 1; index >= 0; index -= 1) {
    if (room.acceptedActions[index].seat !== seat) break;
    count += 1;
  }
  return count;
}
