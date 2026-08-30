import type { PlaySurfaceKind, RuleSystem } from "./project-contract";

export function scoreRaceKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "score-race-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "score-race-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function sharedGoalKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "shared-goal-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "shared-goal-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function turnTakingKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "turn-taking-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "turn-taking-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function takeAwayKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "take-away-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "take-away-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function rollAndMoveKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "roll-and-move-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "roll-and-move-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function drawAndScoreKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "draw-and-score-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "draw-and-score-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function pushYourLuckKernel(
  ruleSystem: RuleSystem,
): Extract<
  Extract<RuleSystem["runtimeSupport"], { status: "executable" }>["kernel"],
  { type: "push-your-luck-v1" }
> | null {
  return ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "push-your-luck-v1"
    ? ruleSystem.runtimeSupport.kernel
    : null;
}

export function isHarborVoyage(ruleSystem: RuleSystem): boolean {
  return (
    ruleSystem.runtimeSupport.status === "executable" &&
    ruleSystem.runtimeSupport.kernel.type === "harbor-voyage-v1"
  );
}

export type RoomLocale = "zh" | "en";

export const ROOM_COPY = {
  zh: {
    room: "共享会话 · 可重连",
    studio: "Web Studio",
    replay: "只读回放",
    language: "语言",
    invitation: "邀请好友",
    invitationHint: "把这条链接发给好友；对方直接用浏览器加入，无需安装 Codex。",
    inviteLink: "邀请链接",
    copyInvite: "复制链接",
    copiedInvite: "已复制",
    copyFailed: "复制失败，请手动选择链接。",
    yourSeat: "你的席位",
    chooseSeat: "选择空席位",
    occupied: "已入座",
    turn: "回合",
    currentTurn: "当前行动",
    waitingFor: "等待座位",
    yourTurn: "轮到你了",
    claimSeat: "先选择一个席位，才能参与游戏。",
    waitForOther: "等待另一位玩家完成行动。",
    gameOver: "对局结束",
    winner: "获胜者",
    phase: "流程",
    points: "分数",
    progress: "共享进度",
    turnAction: "轮流行动",
    take: "拿取",
    remaining: "剩余物件",
    move: "前进",
    position: "当前位置",
    roll: "掷骰",
    draw: "抽牌",
    deckRemaining: "牌库剩余",
    lastDraw: "最近抽到",
    deckExhausted: "牌库已用完",
    tiedGame: "平分，无唯一胜者",
    unbanked: "本回合未存分",
    bank: "收手存分",
    bust: "爆掉，未存分清零",
    goalReached: "共同目标已完成",
    turnLimitReached: "回合上限已到",
    playerArea: "玩家区域",
    you: "你",
    actionPanel: "你的行动",
    actionHint: "每回合选择一个行动。提交后由 GoDesk 校验并更新会话状态。",
    actionTitle: "行动",
    actionSubmitted: "已提交",
    noActions: "当前版本没有可执行行动。",
    actionRejected: "行动未被接受，请确认轮到你的席位。",
    seatRejected: "这个席位暂时无法认领。",
    seatAlreadyClaimed: "这个浏览器已经占用了另一个席位。",
    sourceText: "规则来源",
    log: "行动记录",
    noLog: "尚无行动。合法行动会出现在这里。",
    unsupported: "尚未覆盖",
    feedbackTitle: "试玩反馈",
    feedbackHint: "完成一次行动后，留下评分和一句话感受；这会回到创作者的同一项目。",
    feedbackRating: "体验评分",
    feedbackComment: "一句话反馈",
    feedbackPlaceholder: "例如：目标很清楚，但第二回合的选择还不够有张力。",
    feedbackSubmit: "提交反馈",
    feedbackSubmitted: "反馈已保存",
    feedbackRequired: "先入座、选择评分并写下至少两字反馈。",
    feedbackActionRequired: "先完成一次行动，反馈会自动关联到那个时刻。",
    feedbackRejected: "反馈未保存，请确认席位仍属于你。",
    feedbackSummary: "已收到试玩反馈",
    experimentTitle: "这次试玩要验证",
    experimentSignal: "请特别留意：",
    experimentFeedbackHint: "完成一次行动后，请围绕上面的验证问题留下评分和观察；反馈会回到创作者的同一项目。",
    experimentFeedbackComment: "你观察到了什么？",
  },
  en: {
    room: "Shared Session · reconnectable",
    studio: "Web Studio",
    replay: "Read-only replay",
    language: "Language",
    invitation: "Invite a friend",
    invitationHint: "Send this link to a friend. They can join in a browser without installing Codex.",
    inviteLink: "Invite link",
    copyInvite: "Copy link",
    copiedInvite: "Copied",
    copyFailed: "Copy failed. Select the link manually.",
    yourSeat: "Your seat",
    chooseSeat: "Choose an open seat",
    occupied: "Occupied",
    turn: "Turn",
    currentTurn: "Current turn",
    waitingFor: "Waiting for Seat",
    yourTurn: "Your turn",
    claimSeat: "Choose a seat before taking an action.",
    waitForOther: "Wait for the other player to finish their action.",
    gameOver: "Game over",
    winner: "Winner",
    phase: "Flow",
    points: "points",
    progress: "shared progress",
    turnAction: "turn action",
    take: "take",
    remaining: "objects remaining",
    move: "move",
    position: "current position",
    roll: "roll die",
    draw: "draw card",
    deckRemaining: "cards remaining",
    lastDraw: "last draw",
    deckExhausted: "Deck exhausted",
    tiedGame: "Tie — no unique winner",
    unbanked: "unbanked turn score",
    bank: "bank score",
    bust: "Bust — unbanked score lost",
    goalReached: "Shared goal complete",
    turnLimitReached: "Turn limit reached",
    playerArea: "Player areas",
    you: "You",
    actionPanel: "Your action",
    actionHint: "Choose one action each turn. GoDesk validates it and updates the Session State.",
    actionTitle: "Action",
    actionSubmitted: "Submitted",
    noActions: "This build has no executable actions yet.",
    actionRejected: "Action rejected. Check that it is your seat's turn.",
    seatRejected: "That seat cannot be claimed right now.",
    seatAlreadyClaimed: "This browser already owns another seat.",
    sourceText: "Source text",
    log: "Action log",
    noLog: "No actions yet. Accepted actions appear here.",
    unsupported: "Not covered",
    feedbackTitle: "Playtest feedback",
    feedbackHint: "After one action, leave a rating and one sentence. It returns to the creator's same project.",
    feedbackRating: "Experience rating",
    feedbackComment: "One-sentence feedback",
    feedbackPlaceholder: "For example: The goal is clear, but the second-turn choice lacks tension.",
    feedbackSubmit: "Submit feedback",
    feedbackSubmitted: "Feedback saved",
    feedbackRequired: "Claim a seat, choose a rating, and write at least two characters.",
    feedbackActionRequired: "Take one action first. Your feedback will be linked to that moment.",
    feedbackRejected: "Feedback was not saved. Check that the seat is still yours.",
    feedbackSummary: "Playtest feedback received",
    experimentTitle: "This playtest is testing",
    experimentSignal: "Watch for this signal: ",
    experimentFeedbackHint: "After one action, rate the experience and answer the question above. Your observation returns to the creator's same project.",
    experimentFeedbackComment: "What did you observe?",
  },
} as const;

export const CARD_SYMBOLS = ["✦", "◈", "◆", "✹"] as const;

export function roomActionTitle(locale: RoomLocale, index: number) {
  return locale === "zh" ? `行动 ${index + 1}` : `Action ${index + 1}`;
}

export function roomSurfaceCopy(kind: PlaySurfaceKind, locale: RoomLocale) {
  const surfaces: Record<PlaySurfaceKind, Record<RoomLocale, {
    label: string;
    title: string;
    visual: string;
  }>> = {
    table: {
      zh: { label: "桌面游戏", title: "共享桌面", visual: "Rule System 桌面呈现" },
      en: { label: "Table game", title: "Shared table", visual: "Rule System table surface" },
    },
    cards: {
      zh: { label: "卡牌游戏", title: "共享牌面", visual: "Rule System 卡牌呈现" },
      en: { label: "Card game", title: "Shared cards", visual: "Rule System card surface" },
    },
    conversation: {
      zh: { label: "对话游戏", title: "共同创作区", visual: "Rule System 对话呈现" },
      en: { label: "Conversation game", title: "Shared creation space", visual: "Rule System conversation surface" },
    },
    screen: {
      zh: { label: "屏幕游戏", title: "共享状态", visual: "Rule System 屏幕呈现" },
      en: { label: "Screen game", title: "Shared state", visual: "Rule System screen surface" },
    },
    scene: {
      zh: { label: "场景游戏", title: "共享场景", visual: "Rule System 场景呈现" },
      en: { label: "Scene game", title: "Shared scene", visual: "Rule System scene surface" },
    },
    hybrid: {
      zh: { label: "混合游戏", title: "共享游戏空间", visual: "Rule System 混合呈现" },
      en: { label: "Hybrid game", title: "Shared game space", visual: "Rule System hybrid surface" },
    },
  };
  return surfaces[kind][locale];
}

export function readRoomLocale(): RoomLocale {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem("godesk-room-locale") === "en" ? "en" : "zh";
}

export function displayActionDescription(label: string, locale: RoomLocale) {
  if (locale === "en") return label;
  return /[A-Za-z]{3}/.test(label) ? "按 Rule System 执行此行动。" : label;
}

export function displayUnsupported(item: string, locale: RoomLocale) {
  if (locale === "zh") return item;
  if (item.includes("score-race-v1")) {
    return "score-race-v1 only executes recognized turn-based actions and scoring; bidding, movement, payments, random events, and the original rule resolution are not implemented.";
  }
  if (item.includes("shared-goal-v1")) {
    return "shared-goal-v1 only executes explicit shared progress actions and the shared target; other rule behavior is not implemented.";
  }
  if (item.includes("turn-taking-v1")) {
    return "turn-taking-v1 only executes explicit turn-taking actions until the turn limit; winners, scores, resources, and other rule resolution are not implemented.";
  }
  if (item.includes("take-away-v1")) {
    return "take-away-v1 only executes the explicit shared pool, legal take amounts, turn order, and last-taken-wins condition; other rule behavior is not implemented.";
  }
  if (item.includes("roll-and-move-v1")) {
    return "roll-and-move-v1 only executes the explicit die, movement by roll, round-robin turns, and first-to-target victory condition; other rule behavior is not implemented.";
  }
  if (item.includes("draw-and-score-v1")) {
    return "draw-and-score-v1 only executes deterministic shuffle, top-card draw without replacement, score by card value, first-to-target victory, and highest-score deck exhaustion; other rule behavior is not implemented.";
  }
  if (item.includes("push-your-luck-v1")) {
    return "push-your-luck-v1 only executes repeated seeded rolls, one bust face, unbanked turn score, voluntary banking, round-robin turns, and first-to-target victory; other rule behavior is not implemented.";
  }
  return item;
}

export function localizedRoomError(
  reason: unknown,
  locale: RoomLocale,
  kind: "seat" | "action" | "feedback",
) {
  const message = reason instanceof Error ? reason.message : "";
  if (message.includes("feedback_requires_action")) {
    return ROOM_COPY[locale].feedbackActionRequired;
  }
  if (message.includes("seat") || message.includes("入座")) {
    if (message.includes("client_already_seated")) {
      return ROOM_COPY[locale].seatAlreadyClaimed;
    }
    return ROOM_COPY[locale].seatRejected;
  }
  if (kind === "feedback" || message.includes("反馈") || message.includes("feedback")) {
    return ROOM_COPY[locale].feedbackRejected;
  }
  return kind === "seat"
    ? ROOM_COPY[locale].seatRejected
    : ROOM_COPY[locale].actionRejected;
}
