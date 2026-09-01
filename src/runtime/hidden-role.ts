export type HiddenRoleAlignment = "culprit" | "town";
export type HiddenRolePhase = "discuss" | "accuse" | "resolved";

export type HiddenRoleDef = {
  id: string;
  name: string;
  alignment: HiddenRoleAlignment;
};

export type HiddenRoleState = {
  phase: HiddenRolePhase;
  playerCount: number;
  roles: Array<{ seat: number; roleId: string; name: string; alignment: HiddenRoleAlignment }>;
  spoken: number[];
  accused: number[];
  transcript: Array<{ seat: number; text: string }>;
  accusations: Array<{ seat: number; targetSeat: number }>;
  condemnedSeat: number | null;
  winnerAlignment: HiddenRoleAlignment | null;
};

export function defaultHiddenRoles(playerCount: number): HiddenRoleDef[] {
  const roles: HiddenRoleDef[] = [
    { id: "culprit", name: "凶手", alignment: "culprit" },
    { id: "detective", name: "侦探", alignment: "town" },
  ];
  while (roles.length < playerCount) {
    roles.push({
      id: `civilian-${roles.length}`,
      name: "平民",
      alignment: "town",
    });
  }
  return roles.slice(0, playerCount);
}

function nextRandom(state: number) {
  let value = state | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function shuffledRoles(roles: HiddenRoleDef[], seed: number) {
  const deck = [...roles];
  let random = seed >>> 0 || 1;
  for (let index = deck.length - 1; index > 0; index -= 1) {
    random = nextRandom(random);
    const swapIndex = random % (index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function createHiddenRoleState(
  playerCount: number,
  roles: HiddenRoleDef[],
  seed = 42,
): HiddenRoleState {
  const assigned = shuffledRoles(roles, seed);
  return {
    phase: "discuss",
    playerCount,
    roles: assigned.map((role, seat) => ({
      seat,
      roleId: role.id,
      name: role.name,
      alignment: role.alignment,
    })),
    spoken: [],
    accused: [],
    transcript: [],
    accusations: [],
    condemnedSeat: null,
    winnerAlignment: null,
  };
}

export function scopeHiddenRoleState(
  state: HiddenRoleState,
  viewerSeat: number | null,
): HiddenRoleState {
  if (state.phase === "resolved") return state;
  return {
    ...state,
    roles: state.roles.map((role) =>
      role.seat === viewerSeat
        ? role
        : {
            seat: role.seat,
            roleId: "hidden",
            name: "未揭示",
            alignment: "town",
          },
    ),
  };
}

function nextUnfinishedSeat(done: number[], playerCount: number, from: number) {
  for (let offset = 0; offset < playerCount; offset += 1) {
    const seat = (from + offset) % playerCount;
    if (!done.includes(seat)) return seat;
  }
  return from;
}

function resolveAccusations(state: HiddenRoleState): HiddenRoleState {
  const counts = Array.from({ length: state.playerCount }, () => 0);
  for (const accusation of state.accusations) {
    counts[accusation.targetSeat] += 1;
  }
  const highest = Math.max(...counts);
  const condemned = state.accusations.find(
    (accusation) => counts[accusation.targetSeat] === highest,
  )?.targetSeat ?? 0;
  const condemnedRole = state.roles.find((role) => role.seat === condemned);
  const winnerAlignment = condemnedRole?.alignment === "culprit" ? "town" : "culprit";
  return {
    ...state,
    phase: "resolved",
    condemnedSeat: condemned,
    winnerAlignment,
  };
}

export function applyHiddenRoleIntent(
  state: HiddenRoleState,
  seat: number,
  actionId: string,
  payload?: Record<string, unknown>,
): { state: HiddenRoleState; points: number } | null {
  if (state.phase === "resolved") return null;
  if (actionId === "speak") {
    if (state.phase !== "discuss") return null;
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (text.length < 2 || state.spoken.includes(seat)) return null;
    const spoken = [...state.spoken, seat];
    const next: HiddenRoleState = {
      ...state,
      spoken,
      transcript: [...state.transcript, { seat, text }],
    };
    if (spoken.length >= state.playerCount) {
      return { state: { ...next, phase: "accuse" }, points: 0 };
    }
    return { state: next, points: 0 };
  }
  if (actionId === "accuse") {
    if (state.phase !== "accuse") return null;
    const targetSeat = Number(payload?.targetSeat);
    if (
      !Number.isInteger(targetSeat) ||
      targetSeat < 0 ||
      targetSeat >= state.playerCount ||
      targetSeat === seat ||
      state.accused.includes(seat)
    ) {
      return null;
    }
    const accused = [...state.accused, seat];
    const next: HiddenRoleState = {
      ...state,
      accused,
      accusations: [...state.accusations, { seat, targetSeat }],
    };
    if (accused.length >= state.playerCount) {
      return { state: resolveAccusations(next), points: 0 };
    }
    return { state: next, points: 0 };
  }
  return null;
}

export function hiddenRoleActiveSeat(state: HiddenRoleState) {
  if (state.phase === "discuss") {
    return nextUnfinishedSeat(state.spoken, state.playerCount, 0);
  }
  if (state.phase === "accuse") {
    return nextUnfinishedSeat(state.accused, state.playerCount, 0);
  }
  return 0;
}

export function hiddenRoleWinnerSeat(state: HiddenRoleState) {
  if (state.phase !== "resolved" || !state.winnerAlignment) return null;
  return state.roles.find((role) => role.alignment === state.winnerAlignment)?.seat ?? null;
}

export function pickHiddenRoleBotAction(
  state: HiddenRoleState,
  seat: number,
): { actionId: string; payload: Record<string, unknown> } | null {
  if (state.phase === "discuss" && !state.spoken.includes(seat)) {
    return { actionId: "speak", payload: { text: `座位 ${seat} 认为要看今晚谁在回避问题。` } };
  }
  if (state.phase === "accuse" && !state.accused.includes(seat)) {
    const targetSeat = (seat + 1) % state.playerCount;
    return { actionId: "accuse", payload: { targetSeat } };
  }
  return null;
}
