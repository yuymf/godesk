/**
 * G3D-10：PlayEvent → cue 映射与变体取用（SPEC §3.6 / §4.8）。
 *
 * 纯函数，不碰 howler / DOM。客户端看不到 kernel 的 PlayEvent 流，
 * 只看到房间快照里的 `acceptedActions`（每条带 actionId = action.type、payload
 * 与动作后的 SessionState），所以这里从相邻两次快照的差量推导 cue：
 * - `action_applied`：按 `action.type` 查映射表；
 * - `roll_dice` 后按本座位资源增量触发 `gain`（每种增加的资源 1 次）；
 * - `ended`（status 首次变为 complete）：本座位获胜 → `win`，否则 `lose`。
 */

export const CUE_IDS = [
  "hover",
  "select",
  "illegal",
  "panel",
  "toggle",
  "place",
  "upgrade",
  "road",
  "move",
  "steal",
  "dice",
  "gain",
  "trade",
  "turn",
  "win",
  "lose",
] as const;

export type CueId = (typeof CUE_IDS)[number];

/** `gain` 按此下标取变体（§3.6）。 */
export const GAIN_RESOURCES = ["wood", "brick", "sheep", "wheat", "ore"] as const;
export type GainResource = (typeof GAIN_RESOURCES)[number];

/** `trade` 按此下标取变体（§3.6）。 */
export const TRADE_KINDS = ["offer", "accept", "decline", "bank"] as const;
export type TradeKind = (typeof TRADE_KINDS)[number];

export type CueRequest = {
  cue: CueId;
  /** 仅 `gain` 使用 */
  resource?: GainResource;
  /** 仅 `trade` 使用 */
  tradeKind?: TradeKind;
  /** 触发来源，写入 cue 日志便于 e2e 断言 */
  source: string;
};

/**
 * 默认 cue → sprite 片段（片段名与 G3D-26 的 `assets/audio/sfx-*.json` 一致）。
 * 数组顺序即变体下标。
 */
export const DEFAULT_CUE_FRAGMENTS: Readonly<Record<CueId, readonly string[]>> = Object.freeze({
  hover: ["sfx/hover"],
  select: ["sfx/select"],
  illegal: ["sfx/illegal"],
  panel: ["sfx/panel-1", "sfx/panel-2"],
  toggle: ["sfx/toggle"],
  place: ["sfx/place-1", "sfx/place-2"],
  upgrade: ["sfx/upgrade"],
  road: ["sfx/road-1", "sfx/road-2"],
  move: ["sfx/move"],
  steal: ["sfx/steal"],
  dice: ["sfx/dice-1", "sfx/dice-2", "sfx/dice-3", "sfx/dice-4"],
  gain: ["sfx/gain-wood", "sfx/gain-brick", "sfx/gain-sheep", "sfx/gain-wheat", "sfx/gain-ore"],
  trade: ["sfx/trade-1", "sfx/trade-2", "sfx/trade-3", "sfx/trade-4"],
  turn: ["sfx/turn-1", "sfx/turn-2"],
  win: ["sfx/win"],
  lose: ["sfx/lose"],
});

/** 核心 sprite（可交互前加载）包含的 cue；其余在扩展 sprite（可交互后加载）。§4.8 */
export const CORE_SPRITE_CUES: ReadonlySet<CueId> = new Set<CueId>([
  "hover",
  "select",
  "illegal",
  "place",
  "road",
  "dice",
  "turn",
  "win",
  "lose",
]);

/**
 * `action.type` → cue。覆盖六角岛全部动作，以及其他空间 Kernel 的常见动作。
 * `move_robber` / `play_knight` 先给 `move`，抢到资源时再追加 `steal`（见 cuesForRoomDelta）。
 */
export const ACTION_CUES: Readonly<Record<string, CueRequest["cue"]>> = Object.freeze({
  place_settlement: "place",
  place_city: "upgrade",
  place_road: "road",
  play_road_building: "road",
  roll_dice: "dice",
  move_robber: "move",
  play_knight: "move",
  bank_trade: "trade",
  player_trade: "trade",
  buy_dev: "panel",
  discard: "panel",
  end_turn: "turn",
  // 其他 Kernel
  place: "place",
  claim: "road",
  bid: "trade",
  pass: "turn",
});

const TRADE_KIND_BY_ACTION: Readonly<Record<string, TradeKind>> = Object.freeze({
  bank_trade: "bank",
  player_trade: "accept",
  bid: "offer",
});

/**
 * 取变体下标：`gain` 按资源、`trade` 按交易类型，其余随机。
 * 变体数不足时回落到 0（素材缺片段也不抛错）。
 */
export function pickVariantIndex(request: CueRequest, variantCount: number, random: () => number = Math.random): number {
  if (variantCount <= 1) return 0;
  if (request.cue === "gain" && request.resource) {
    const index = GAIN_RESOURCES.indexOf(request.resource);
    return index >= 0 && index < variantCount ? index : 0;
  }
  if (request.cue === "trade" && request.tradeKind) {
    const index = TRADE_KINDS.indexOf(request.tradeKind);
    return index >= 0 && index < variantCount ? index : 0;
  }
  return Math.min(variantCount - 1, Math.floor(random() * variantCount));
}

/** 与 `src/creator/project-contract.ts` 中 RoomSession 兼容的最小形状。 */
export type AudioRoomSnapshot = {
  state: AudioSessionState;
  acceptedActions: readonly {
    sequence: number;
    seat: number;
    actionId: string;
    payload?: Record<string, unknown>;
    state: AudioSessionState;
  }[];
};

export type AudioSessionState = {
  status: "active" | "complete";
  winnerSeat: number | null;
  hexSettlement?: { players: readonly { resources: Record<string, number> }[] };
};

function resourcesOf(state: AudioSessionState | undefined, seat: number | null): Record<string, number> | null {
  if (!state?.hexSettlement || seat === null) return null;
  return state.hexSettlement.players[seat]?.resources ?? null;
}

function total(resources: Record<string, number> | null): number {
  if (!resources) return 0;
  return Object.values(resources).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

/**
 * 从上一份快照到下一份快照推导要播放的 cue（按动作顺序）。
 * `prev` 为 null 表示首次进入房间：不回放历史，只返回空。
 */
export function cuesForRoomDelta(
  prev: AudioRoomSnapshot | null,
  next: AudioRoomSnapshot,
  seat: number | null,
): CueRequest[] {
  if (!prev) return [];
  const lastSeen = prev.acceptedActions.at(-1)?.sequence ?? -1;
  const fresh = next.acceptedActions.filter((action) => action.sequence > lastSeen);
  const cues: CueRequest[] = [];
  let before: AudioSessionState = prev.state;
  for (const action of fresh) {
    const cue = ACTION_CUES[action.actionId];
    const source = `action:${action.actionId}#${action.sequence}`;
    if (cue) {
      const tradeKind = cue === "trade" ? TRADE_KIND_BY_ACTION[action.actionId] : undefined;
      cues.push({ cue, source, ...(tradeKind ? { tradeKind } : {}) });
    }
    if (action.actionId === "move_robber" || action.actionId === "play_knight") {
      const mineBefore = total(resourcesOf(before, action.seat));
      const mineAfter = total(resourcesOf(action.state, action.seat));
      if (mineAfter > mineBefore) cues.push({ cue: "steal", source });
    }
    if (action.actionId === "roll_dice") {
      const mineBefore = resourcesOf(before, seat);
      const mineAfter = resourcesOf(action.state, seat);
      if (mineBefore && mineAfter) {
        for (const resource of GAIN_RESOURCES) {
          if ((mineAfter[resource] ?? 0) > (mineBefore[resource] ?? 0)) {
            cues.push({ cue: "gain", resource, source });
          }
        }
      }
    }
    before = action.state;
  }
  if (prev.state.status !== "complete" && next.state.status === "complete") {
    // 观战者（seat 为 null）听胜利音；平局（winnerSeat 为 null）听失败音。
    const won = next.state.winnerSeat !== null && (seat === null || next.state.winnerSeat === seat);
    cues.push({ cue: won ? "win" : "lose", source: "ended" });
  }
  return cues;
}
