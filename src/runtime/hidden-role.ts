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

const CULPRIT_NAME = /^(凶手|狼人|杀手|坏人|murderer|culprit|killer|werewolf|mafia|traitor)$/i;
const TOWN_NAME =
  /^(侦探|平民|好人|村民|医生|医师|守卫|detective|civilian|villager|town|innocent|doctor|guard|physician)$/i;
const CULPRIT_CAMP =
  /凶手|坏人|狼人|杀手|culprit|murderer|evil|mafia|werewolf|traitor|killer/i;
const TOWN_CAMP =
  /好人|平民|侦探|小镇|村民|town|villager|innocent|detective|civilian|good/i;

/**
 * True when the source needs multi-act discussion, clue boards, or staged
 * evidence loops. The honest one-shot speak→accuse→reveal subset must not
 * silently wear those scripts.
 */
export function isMultiActHiddenRoleCorpus(corpus: string): boolean {
  const multiAct =
    /第[一二三四五六七八九十\d]+\s*幕|多幕|幕间|act\s*[1-9]|multi[- ]?act|multiple\s+acts?/i.test(
      corpus,
    );
  const multiRoundDiscuss =
    /多轮讨论|两轮发言|三轮发言|第[二三]轮讨论|两轮讨论|discuss(?:ion)?\s+for\s+(?:two|three|[2-9])\s+rounds?|multiple\s+rounds?\s+of\s+discuss/i.test(
      corpus,
    );
  const clueBoard =
    /线索板|搜证板|证物板|证据板|clue\s*board|evidence\s*board|investigation\s*board/i.test(
      corpus,
    );
  const stagedSearch =
    /搜证阶段|取证阶段|搜证.{0,24}讨论|讨论.{0,24}搜证|search(?:ing)?\s+(?:for\s+)?clues?.{0,40}discuss/i.test(
      corpus,
    );
  return multiAct || multiRoundDiscuss || clueBoard || stagedSearch;
}

function inferAlignment(
  name: string,
  camp: string | undefined,
): HiddenRoleAlignment | null {
  if (camp) {
    if (CULPRIT_CAMP.test(camp) && !TOWN_CAMP.test(camp)) return "culprit";
    if (TOWN_CAMP.test(camp) && !CULPRIT_CAMP.test(camp)) return "town";
    if (CULPRIT_CAMP.test(camp)) return "culprit";
    if (TOWN_CAMP.test(camp)) return "town";
  }
  if (CULPRIT_NAME.test(name)) return "culprit";
  if (TOWN_NAME.test(name)) return "town";
  return null;
}

function slugifyRoleId(
  name: string,
  alignment: HiddenRoleAlignment,
  index: number,
  used: Set<string>,
): string {
  const lower = name.trim().toLowerCase();
  let base: string;
  if (CULPRIT_NAME.test(lower) || (alignment === "culprit" && CULPRIT_NAME.test(name))) {
    base = "culprit";
  } else if (/^侦探$|^detective$/i.test(name)) {
    base = "detective";
  } else if (/^平民$|^civilian$|^villager$/i.test(name)) {
    base = `civilian-${index}`;
  } else {
    const ascii = lower
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);
    base = ascii.length >= 2 ? ascii : `${alignment}-${index}`;
  }
  let candidate = base.slice(0, 40);
  let suffix = 2;
  while (used.has(candidate)) {
    const trimmed = base.slice(0, Math.max(1, 40 - (`-${suffix}`).length));
    candidate = `${trimmed}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

type ExtractedRole = { name: string; alignment: HiddenRoleAlignment | null };

function pushExtracted(bucket: ExtractedRole[], nameRaw: string, camp?: string) {
  let name = nameRaw.trim().replace(/[.,;:!?。，；：！？]+$/g, "");
  name = name.replace(/^一张/, "").replace(/牌$/, "").trim();
  if (name.length < 1 || name.length > 16) return;
  if (
    /玩家|座位|发言|指控|身份|角色|每人|一张|card|player|seat|role/i.test(name)
  ) {
    return;
  }
  if (bucket.some((role) => role.name === name)) return;
  bucket.push({ name, alignment: inferAlignment(name, camp) });
}

function extractNamedRoles(corpus: string): ExtractedRole[] {
  const found: ExtractedRole[] = [];

  for (const match of corpus.matchAll(
    /一张\s*([\u4e00-\u9fffA-Za-z][^\s，、,（(。；;]{0,14}?)牌(?:\s*[（(]([^）)]{1,16})[）)])?/g,
  )) {
    pushExtracted(found, match[1], match[2]);
  }

  for (const match of corpus.matchAll(
    /(?:身份牌|角色列表|角色|roles?)\s*[:：]\s*([^\n。.;]{4,160})/gi,
  )) {
    const chunk = match[1];
    for (const part of chunk.split(/[、,/，;；]+|(?:\s+and\s+)/i)) {
      const labeled = part
        .trim()
        .match(/^[\s「"']*([^\s（()」"']{1,16})\s*[（(]([^）)]{1,16})[）)]/);
      if (labeled) {
        pushExtracted(found, labeled[1], labeled[2]);
        continue;
      }
      const bare = part.trim().match(/^[\s「"']*([^\s，,;；」"']{1,16})/);
      if (bare) pushExtracted(found, bare[1]);
    }
  }

  for (const match of corpus.matchAll(
    /(?:one|a)\s+([A-Za-z][A-Za-z0-9' -]{1,20}?)\s+cards?(?:\s*[（(]([^）)]{1,20})[）)])?/gi,
  )) {
    pushExtracted(found, match[1], match[2]);
  }

  return found;
}

/**
 * Derive seat roles from corpus names/camps when present.
 * Falls back to 凶手 / 侦探 / 平民 defaults. Always returns exactly
 * `playerCount` roles with one culprit.
 */
export function deriveHiddenRoles(
  corpus: string,
  playerCount: number,
): HiddenRoleDef[] {
  const count = Math.max(2, Math.min(6, playerCount | 0));
  const extracted = extractNamedRoles(corpus);
  if (extracted.length < 2) {
    return defaultHiddenRoles(count);
  }

  const sized = extracted.slice(0, count);
  while (sized.length < count) {
    sized.push({ name: "平民", alignment: "town" });
  }

  let culpritIndex = sized.findIndex((role) => role.alignment === "culprit");
  if (culpritIndex < 0) {
    const namedCulprit = sized.findIndex((role) => CULPRIT_NAME.test(role.name));
    culpritIndex = namedCulprit >= 0 ? namedCulprit : 0;
  }

  const used = new Set<string>();
  return sized.map((role, index) => {
    const alignment: HiddenRoleAlignment =
      index === culpritIndex ? "culprit" : "town";
    return {
      id: slugifyRoleId(role.name, alignment, index, used),
      name: role.name,
      alignment,
    };
  });
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
