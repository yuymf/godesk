import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Resource } from "../runtime/adapters/hex-settlement";
import type { LegalAction } from "../runtime/play-kernel";
import {
  listHexSettlementLegalActionsForSession,
  type HexSettlementBoardState,
} from "./hex-settlement-session";
import type { RoomLocale } from "./room-presentation";
import {
  BUILD_ICON_URL,
  InkIcon,
  ISLAND_FLOURISH_URL,
  RESOURCE_AI_ICON_URL,
  RESOURCE_CARD_URL,
  RESOURCE_ICON_ID,
  seatMarkUrl,
} from "./tidewell-hud-assets";
import {
  DEFAULT_DESKTOP_FRAME,
  DEFAULT_NARROW_FRAME,
  type ViewportFrame,
} from "../render3d/viewport-frame";
import "./tidewell-game-screen.css";

export type { HexSettlementBoardState } from "./hex-settlement-session";

const LazySceneHost = lazy(async () => {
  const mod = await import("../render3d");
  return { default: mod.SceneHost };
});

const SEAT_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12"] as const;
const HOUSE_NAMES = {
  zh: ["赤席", "蓝席", "翠席", "金席"],
  en: ["Red house", "Blue house", "Green house", "Gold house"],
} as const;

const RESOURCE_LABEL = {
  zh: { wood: "木", brick: "砖", sheep: "羊", wheat: "麦", ore: "矿" },
  en: { wood: "Wood", brick: "Brick", sheep: "Sheep", wheat: "Wheat", ore: "Ore" },
} as const;

const COPY = {
  zh: {
    board: "汐屿",
    island: "汐屿群岛",
    hud: "对局状态",
    active: "当前行动",
    seat: "座位",
    phase: "阶段",
    dice: "骰子",
    noDice: "尚未掷骰",
    resources: "你的资源",
    vp: "胜利点",
    robber: "雾灯",
    longestRoad: "最长栈道",
    largestArmy: "最大军队",
    none: "无",
    lastAction: "最近行动",
    noLast: "尚无行动",
    gameOver: "对局结束",
    winner: "获胜者",
    yourTurn: "轮到你行动",
    waiting: "等待对方",
    aiThinking: "电脑思考中",
    roll: "掷骰",
    endTurn: "结束回合",
    buyDev: "购买发展卡",
    playKnight: "打出骑士",
    playRoadBuilding: "打出道路建设",
    discard: "弃牌",
    bankTrade: "银行贸易",
    playerTrade: "玩家贸易",
    placeSettlement: "建造渔村",
    placeCity: "升级港镇",
    placeRoad: "铺设栈道",
    moveRobber: "移动雾灯",
    actions: "可用行动",
    boardTargets: "棋盘落点（键盘 / 辅助）",
    primary: "本回合",
    settlers: "开拓者",
    turnPanel: "本回合",
    chronicle: "纪事",
    chat: "闲谈",
    coach: "教练",
    allEvents: "全部",
    rolls: "掷骰",
    trades: "贸易",
    yourHand: "手牌",
    devCards: "发展卡",
    buildRoad: "栈道",
    buildSettlement: "渔村",
    buildCity: "港镇",
    buyCard: "买卡",
    cost: "花费",
    sound: "声音",
    rules: "规则",
    settings: "设置",
    feedback: "反馈",
    home: "返回",
    replay: "只读回放",
    menu: "菜单",
    table: "桌面",
    closeTable: "收起",
    yourSeat: "你的席位",
    logDrawer: "对局日志",
    computer: "电脑",
    you: "你",
    openSeat: "空位",
    vpShort: "分",
    cardsShort: "牌",
    toWin: "还需胜利点",
  },
  en: {
    board: "Tidewell Isles",
    island: "Tidewell Isles",
    hud: "Match status",
    active: "Active seat",
    seat: "Seat",
    phase: "Phase",
    dice: "Dice",
    noDice: "No roll yet",
    resources: "Your resources",
    vp: "VP",
    robber: "Fog lantern",
    longestRoad: "Longest causeway",
    largestArmy: "Largest army",
    none: "None",
    lastAction: "Last action",
    noLast: "No moves yet",
    gameOver: "Game over",
    winner: "Winner",
    yourTurn: "Your turn",
    waiting: "Waiting",
    aiThinking: "Computer thinking",
    roll: "Roll dice",
    endTurn: "End turn",
    buyDev: "Buy development card",
    playKnight: "Play knight",
    playRoadBuilding: "Play road building",
    discard: "Discard",
    bankTrade: "Bank trade",
    playerTrade: "Player trade",
    placeSettlement: "Build fishing village",
    placeCity: "Upgrade harbor town",
    placeRoad: "Lay causeway",
    moveRobber: "Move fog lantern",
    actions: "Available actions",
    boardTargets: "Board targets (keyboard / assistive)",
    primary: "This turn",
    settlers: "The settlers",
    turnPanel: "Your turn",
    chronicle: "Chronicle",
    chat: "Chat",
    coach: "Coach",
    allEvents: "All",
    rolls: "Rolls",
    trades: "Trades",
    yourHand: "Hand",
    devCards: "Development cards",
    buildRoad: "Road",
    buildSettlement: "Settlement",
    buildCity: "City",
    buyCard: "Buy card",
    cost: "Cost",
    sound: "Sound",
    rules: "Rules",
    settings: "Settings",
    feedback: "Feedback",
    home: "Home",
    replay: "Read-only replay",
    menu: "Menu",
    table: "Table",
    closeTable: "Close",
    yourSeat: "Your seat",
    logDrawer: "Match log",
    computer: "Computer",
    you: "You",
    openSeat: "Open",
    vpShort: "VP",
    cardsShort: "cards",
    toWin: "VP to win",
  },
} as const;

function actionKey(action: LegalAction): string {
  return `${action.type}:${JSON.stringify(action.payload ?? null)}`;
}

function phaseLabel(phase: string, locale: RoomLocale): string {
  const map: Record<string, { zh: string; en: string }> = {
    setup: { zh: "初始放置", en: "Setup" },
    roll: { zh: "掷骰", en: "Roll" },
    discard: { zh: "弃牌", en: "Discard" },
    robber: { zh: "移动雾灯", en: "Fog lantern" },
    main: { zh: "建造/贸易", en: "Build / trade" },
    ended: { zh: "结束", en: "Ended" },
  };
  return map[phase]?.[locale] ?? phase;
}

function shortLabelForAction(
  action: LegalAction,
  copy: (typeof COPY)[RoomLocale],
  resourceLabel: (typeof RESOURCE_LABEL)[RoomLocale],
): string {
  switch (action.type) {
    case "place_settlement":
      return copy.placeSettlement;
    case "place_city":
      return copy.placeCity;
    case "place_road":
      return copy.placeRoad;
    case "move_robber":
      return copy.moveRobber;
    case "roll_dice":
      return copy.roll;
    case "end_turn":
      return copy.endTurn;
    case "buy_dev":
      return copy.buyDev;
    case "play_knight":
      return copy.playKnight;
    case "play_road_building":
      return copy.playRoadBuilding;
    case "discard": {
      const resource = String(action.payload?.resource ?? "") as Resource;
      return `${copy.discard} ${resourceLabel[resource] ?? resource}`;
    }
    case "bank_trade": {
      const give = String(action.payload?.give ?? "") as Resource;
      const take = String(action.payload?.take ?? "") as Resource;
      const ratio = Number(action.payload?.ratio ?? 4);
      return `${copy.bankTrade} ${ratio}${resourceLabel[give] ?? give}→${resourceLabel[take] ?? take}`;
    }
    case "player_trade": {
      const give = String(action.payload?.give ?? "") as Resource;
      const take = String(action.payload?.take ?? "") as Resource;
      const withSeat = action.payload?.withSeat;
      return `${copy.playerTrade} 1${resourceLabel[give] ?? give}↔P${withSeat} ${resourceLabel[take] ?? take}`;
    }
    default:
      return action.label;
  }
}


/** Player-visible label for Kernel lastAction type ids (never show raw place_road etc.). */
export function formatLastAction(
  lastAction: string | null | undefined,
  locale: RoomLocale,
): string {
  if (!lastAction) return COPY[locale].noLast;
  const copy = COPY[locale];
  const map: Record<string, string> = {
    place_settlement: copy.placeSettlement,
    place_city: copy.placeCity,
    place_road: copy.placeRoad,
    move_robber: copy.moveRobber,
    roll_dice: copy.roll,
    end_turn: copy.endTurn,
    buy_dev: copy.buyDev,
    play_knight: copy.playKnight,
    play_road_building: copy.playRoadBuilding,
    discard: copy.discard,
    bank_trade: copy.bankTrade,
    player_trade: copy.playerTrade,
  };
  return map[lastAction] ?? copy.noLast;
}

/** Unique accessible name (may include payload ids for disambiguation). */
function labelForBoardAction(
  action: LegalAction,
  copy: (typeof COPY)[RoomLocale],
  resourceLabel: (typeof RESOURCE_LABEL)[RoomLocale],
): string {
  switch (action.type) {
    case "place_settlement":
      return `${copy.placeSettlement} · ${String(action.payload?.vertexId ?? "")}`;
    case "place_city":
      return `${copy.placeCity} · ${String(action.payload?.vertexId ?? "")}`;
    case "place_road":
      return `${copy.placeRoad} · ${String(action.payload?.edgeId ?? "")}`;
    case "move_robber":
      return `${copy.moveRobber} · ${String(action.payload?.hex ?? "")}`;
    default:
      return shortLabelForAction(action, copy, resourceLabel);
  }
}

/**
 * G3D-04 Room surface: 3D SceneHost + HUD + accessible legal-action list.
 * No SVG board, no 2D fallback.
 */
export function HexSettlementBoard({
  hexSettlement,
  activeSeat,
  viewerSeat,
  status,
  enabled,
  locale = "zh",
  winnerSeat = null,
  busy = false,
  aiSeats = [],
  onAct,
  onClaimSeat,
  homeHref = "/chatgpt-plugin/games",
  replayUrl,
}: {
  hexSettlement: HexSettlementBoardState;
  activeSeat: number;
  viewerSeat: number | null;
  status: "active" | "complete";
  enabled: boolean;
  locale?: RoomLocale;
  winnerSeat?: number | null;
  busy?: boolean;
  aiSeats?: number[];
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
  onClaimSeat?: (seat: number) => void;
  homeHref?: string;
  replayUrl?: string;
}) {
  const [boardTargetsOpen, setBoardTargetsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [logTab, setLogTab] = useState<"chronicle" | "chat" | "coach">("chronicle");
  const [logOpenMobile, setLogOpenMobile] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [viewportFrame, setViewportFrame] = useState<ViewportFrame>(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches
      ? DEFAULT_NARROW_FRAME
      : DEFAULT_DESKTOP_FRAME,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 800px)");
    const apply = () =>
      setViewportFrame(mq.matches ? DEFAULT_NARROW_FRAME : DEFAULT_DESKTOP_FRAME);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const [resourceGain, setResourceGain] = useState<Partial<Record<Resource, number>>>({});
  const prevResourcesRef = useRef<Record<Resource, number> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setBoardTargetsOpen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const copy = COPY[locale];
  const resourceLabel = RESOURCE_LABEL[locale];
  const interactive =
    enabled && status === "active" && Boolean(onAct) && !busy;
  const legalPlayer =
    interactive && viewerSeat !== null ? viewerSeat : activeSeat;
  const legalActions = useMemo(
    () =>
      status === "active"
        ? listHexSettlementLegalActionsForSession({
            hexSettlement,
            activeSeat,
            status,
            playerId: legalPlayer,
          })
        : [],
    [hexSettlement, activeSeat, status, legalPlayer],
  );
  const showLegal =
    interactive && viewerSeat !== null && viewerSeat === activeSeat;

  const vpScores = useMemo(
    () =>
      hexSettlement.players.map((player, seat) => {
        let points =
          player.settlements.length + player.cities.length * 2 + player.vpCards;
        if (hexSettlement.longestRoadOwner === seat) points += 2;
        if (hexSettlement.largestArmyOwner === seat) points += 2;
        return points;
      }),
    [hexSettlement],
  );

  const viewer = viewerSeat !== null ? hexSettlement.players[viewerSeat] : null;
  const viewerResources = viewer?.resources ?? null;

  useEffect(() => {
    if (!viewerResources) return;
    const prev = prevResourcesRef.current;
    prevResourcesRef.current = { ...viewerResources };
    if (!prev) return;
    const delta: Partial<Record<Resource, number>> = {};
    let any = false;
    (Object.keys(resourceLabel) as Resource[]).forEach((r) => {
      const d = (viewerResources[r] ?? 0) - (prev[r] ?? 0);
      if (d > 0) {
        delta[r] = d;
        any = true;
      }
    });
    if (!any) return;
    setResourceGain(delta);
    const t = window.setTimeout(() => setResourceGain({}), 1600);
    return () => window.clearTimeout(t);
  }, [viewerResources, resourceLabel]);

  const statusLine =
    status === "complete"
      ? `${copy.gameOver}${winnerSeat !== null ? ` · ${copy.winner} ${winnerSeat}` : ""}`
      : viewerSeat !== null && viewerSeat === activeSeat
        ? copy.yourTurn
        : aiSeats.includes(activeSeat)
          ? `${copy.aiThinking} · ${copy.seat} ${activeSeat}`
          : `${copy.waiting} · ${copy.seat} ${activeSeat}`;
  const diceLine =
    hexSettlement.lastDice === null
      ? copy.noDice
      : `${copy.dice} ${hexSettlement.lastDice[0]} + ${hexSettlement.lastDice[1]} = ${hexSettlement.lastDice[0] + hexSettlement.lastDice[1]}`;

  const accessibleActions = showLegal ? legalActions : [];
  const boardTargetTypes = new Set([
    "place_settlement",
    "place_city",
    "place_road",
    "move_robber",
  ]);
  const primaryActions = accessibleActions.filter((a) => !boardTargetTypes.has(a.type));
  const targetActions = accessibleActions.filter((a) => boardTargetTypes.has(a.type));

  const pickableActions = useMemo(
    () =>
      showLegal
        ? legalActions.filter((action) =>
            ["place_settlement", "place_city", "place_road", "move_robber"].includes(
              action.type,
            ),
          )
        : [],
    [showLegal, legalActions],
  );

  const handlePick = useCallback(
    (action: { type: string; payload?: Record<string, unknown> }) => {
      if (!showLegal || busy) return;
      onAct?.(action.type, action.payload);
    },
    [showLegal, busy, onAct],
  );

  function fireFirst(type: string) {
    const match = accessibleActions.find((a) => a.type === type);
    if (!match || busy) return;
    onAct?.(
      match.type,
      match.payload ? ({ ...match.payload } as Record<string, unknown>) : undefined,
    );
  }

  function hasLegal(type: string) {
    return accessibleActions.some((a) => a.type === type);
  }

  const primaryCta =
    primaryActions.find((a) => a.type === "roll_dice") ??
    primaryActions.find((a) => a.type === "end_turn") ??
    primaryActions[0] ??
    null;

  const BUILD_COSTS: Array<{
    id: string;
    type: string;
    label: string;
    cost: Resource[];
  }> = [
    { id: "road", type: "place_road", label: copy.buildRoad, cost: ["wood", "brick"] },
    {
      id: "settlement",
      type: "place_settlement",
      label: copy.buildSettlement,
      cost: ["wood", "brick", "sheep", "wheat"],
    },
    {
      id: "city",
      type: "place_city",
      label: copy.buildCity,
      cost: ["wheat", "wheat", "ore", "ore", "ore"],
    },
    {
      id: "buy",
      type: "buy_dev",
      label: copy.buyCard,
      cost: ["sheep", "wheat", "ore"],
    },
  ];

  const chronicleLines = [
    statusLine,
    diceLine,
    `${copy.lastAction}: ${formatLastAction(hexSettlement.lastAction, locale)}`,
    `${copy.phase}: ${phaseLabel(hexSettlement.phase, locale)}`,
    `${copy.longestRoad}: ${
      hexSettlement.longestRoadOwner === null
        ? copy.none
        : `${copy.seat} ${hexSettlement.longestRoadOwner}`
    }`,
    `${copy.largestArmy}: ${
      hexSettlement.largestArmyOwner === null
        ? copy.none
        : `${copy.seat} ${hexSettlement.largestArmyOwner}`
    }`,
  ];

  const renderActionButton = (action: LegalAction, compact: boolean) => (
    <li key={actionKey(action)}>
      <button
        aria-label={labelForBoardAction(action, copy, resourceLabel)}
        className={`tidewell-action${compact ? " is-board-target" : ""}`}
        disabled={busy}
        onClick={() =>
          onAct?.(
            action.type,
            action.payload
              ? ({ ...action.payload } as Record<string, unknown>)
              : undefined,
          )
        }
        type="button"
      >
        {shortLabelForAction(action, copy, resourceLabel)}
      </button>
    </li>
  );

  return (
    <div
      aria-label={copy.board}
      className="tidewell-board hex-settlement-board tidewell-game-screen"
      data-status={status}
      role="region"
    >
      <header className="tidewell-topbar">
        <div className="tidewell-topbar-brand">
          <a
            aria-label={copy.home}
            className="tidewell-home-btn tidewell-wood-icon"
            href={homeHref}
            title={copy.home}
          >
            ←
          </a>
          <span aria-hidden="true" className="tidewell-wax-dot" />
          <strong className="tidewell-brand-name">{copy.board}</strong>
        </div>
        <div className="tidewell-topbar-center">
          <span className="tidewell-island-name">{copy.island}</span>
          <p className="tidewell-topbar-status">{statusLine}</p>
        </div>
        <div className="tidewell-topbar-actions">
          {replayUrl ? (
            <a
              className="tidewell-wood-icon tidewell-replay-link"
              href={replayUrl}
              title={copy.replay}
            >
              ▷
            </a>
          ) : null}
          <button
            className="tidewell-wood-icon tidewell-sound-chip"
            onClick={() => {
              const trigger = document.querySelector<HTMLButtonElement>(
                ".room-sound-settings-trigger",
              );
              trigger?.click();
              const host = document.querySelector<HTMLElement>(".room-sound-settings");
              if (host) host.dataset.open = "1";
            }}
            title={locale === "zh" ? "声音设置" : "Sound settings"}
            type="button"
          >
            ♪
          </button>
          <button
            className="tidewell-wood-icon tidewell-log-chip"
            onClick={() => setLogOpenMobile((v) => !v)}
            title={copy.logDrawer}
            type="button"
          >
            ≡
          </button>
          <details className="tidewell-menu">
            <summary className="tidewell-wood-icon" title={copy.menu}>
              ⚙
            </summary>
            <div className="tidewell-menu-panel">
              {onClaimSeat ? (
                <label className="tidewell-seat-select">
                  <span>{copy.yourSeat}</span>
                  <select
                    aria-label={copy.yourSeat}
                    onChange={(event) => {
                      const next = Number(event.currentTarget.value);
                      if (Number.isInteger(next)) onClaimSeat(next);
                    }}
                    value={viewerSeat ?? ""}
                  >
                    <option value="">
                      {locale === "zh" ? "选择空席位" : "Pick a seat"}
                    </option>
                    {hexSettlement.players.map((_, seat) => (
                      <option
                        disabled={aiSeats.includes(seat) && seat !== viewerSeat}
                        key={`seat-opt-${seat}`}
                        value={seat}
                      >
                        {locale === "zh" ? `座位 ${seat}` : `Seat ${seat}`}
                        {aiSeats.includes(seat)
                          ? locale === "zh"
                            ? " · 电脑"
                            : " · AI"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className="tidewell-chip-btn"
                onClick={() => setLogOpenMobile((v) => !v)}
                type="button"
              >
                {copy.logDrawer}
              </button>
              <button
                className="tidewell-chip-btn"
                onClick={() => {
                  const drawer = document.getElementById("room-feedback-drawer");
                  if (drawer instanceof HTMLDetailsElement) drawer.open = true;
                }}
                type="button"
              >
                {copy.feedback}
              </button>
              <button
                className="tidewell-chip-btn"
                onClick={() => {
                  const trigger = document.querySelector<HTMLButtonElement>(
                    ".room-sound-settings-trigger",
                  );
                  trigger?.click();
                  const host = document.querySelector<HTMLElement>(
                    ".room-sound-settings",
                  );
                  if (host) host.dataset.open = host.dataset.open === "1" ? "0" : "1";
                }}
                type="button"
              >
                {copy.sound}
              </button>
              {replayUrl ? (
                <a className="tidewell-chip-btn" href={replayUrl}>
                  {copy.replay}
                </a>
              ) : null}
            </div>
          </details>
        </div>
      </header>

      <div className="tidewell-game-body">
        <aside aria-label={copy.hud} className="tidewell-players tidewell-hud" role="region">
          <h2 className="tidewell-panel-title">{copy.settlers}</h2>
          <ul className="tidewell-player-list">
            {hexSettlement.players.map((player, seat) => {
              const isActive = seat === activeSeat;
              const isYou = seat === viewerSeat;
              const isAi = aiSeats.includes(seat);
              const cards =
                Object.values(player.resources).reduce((a, b) => a + b, 0);
              return (
                <li
                  className={`tidewell-player-card${isActive ? " is-active" : ""}${
                    isYou ? " is-you" : ""
                  }`}
                  key={`seat-${seat}`}
                  style={
                    {
                      "--seat-color": SEAT_COLORS[seat % SEAT_COLORS.length],
                    } as CSSProperties
                  }
                >
                  <div className="tidewell-player-avatar tidewell-medallion">
                    {seatMarkUrl(seat) ? (
                      <img alt="" height={40} src={seatMarkUrl(seat)} width={40} />
                    ) : (
                      <span aria-hidden="true" className="tidewell-seat-swatch" />
                    )}
                  </div>
                  <div className="tidewell-player-meta">
                    <b>
                      {isYou ? copy.you : isAi ? copy.computer : `${copy.seat} ${seat}`}
                    </b>
                    <span className="tidewell-house-name">
                      {HOUSE_NAMES[locale][seat % HOUSE_NAMES[locale].length]}
                    </span>
                    <span className="tidewell-player-stats">
                      <span title={copy.vp}>
                        ♛ {vpScores[seat]}/{hexSettlement.victoryPointsToWin ?? 10}
                      </span>
                      <span title={copy.resources}>
                        🂠 {cards}
                      </span>
                      <span title={copy.devCards}>
                        ✦ {player.devCards.length}
                      </span>
                    </span>
                  </div>
                  {isYou && isActive && status === "active" ? (
                    <span className="tidewell-turn-badge">{copy.yourTurn}</span>
                  ) : isActive && status === "active" ? (
                    <span className="tidewell-turn-badge">{copy.aiThinking}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <dl className="tidewell-hud-awards">
            <div>
              <dt>{copy.longestRoad}</dt>
              <dd>
                {hexSettlement.longestRoadOwner === null
                  ? copy.none
                  : `${copy.seat} ${hexSettlement.longestRoadOwner}`}
              </dd>
            </div>
            <div>
              <dt>{copy.largestArmy}</dt>
              <dd>
                {hexSettlement.largestArmyOwner === null
                  ? copy.none
                  : `${copy.seat} ${hexSettlement.largestArmyOwner}`}
              </dd>
            </div>
            <div>
              <dt>{copy.robber}</dt>
              <dd>{hexSettlement.robberHex}</dd>
            </div>
          </dl>
          {/* Keep compact legacy status for screen readers / older asserts */}
          <div className="tidewell-hud-status sr-only">
            <span className="tidewell-kicker">{copy.active}</span>
            <strong>
              {copy.seat} {activeSeat} · {copy.phase}{" "}
              {phaseLabel(hexSettlement.phase, locale)}
            </strong>
            <p>{statusLine}</p>
            <p className="tidewell-hud-dice">{diceLine}</p>
            <p>
              {copy.lastAction}:{" "}
              {formatLastAction(hexSettlement.lastAction, locale)}
            </p>
          </div>
          <div className="tidewell-hud-scores sr-only" aria-label={copy.vp}>
            {vpScores.map((vp, seat) => (
              <div
                className={`tidewell-score${seat === activeSeat ? " is-active" : ""}`}
                key={`vp-${seat}`}
              >
                <b>
                  {copy.seat} {seat} · {vp} {copy.vp}
                </b>
              </div>
            ))}
          </div>
        </aside>

        <div className="tidewell-stage-wrap">
          <div className="g3d-stage">
            <Suspense fallback={<div aria-busy="true">加载 3D 桌面…</div>}>
              <LazySceneHost
                ariaLabel={copy.board}
                className="room-g3d-scene-host"
                hexSettlement={hexSettlement}
                activeSeat={activeSeat}
                interactive={showLegal}
                legalActions={pickableActions}
                onPick={handlePick}
                viewportFrame={viewportFrame}
              />
            </Suspense>
          </div>
        </div>

        <aside
          className={`tidewell-turn-column${logOpenMobile ? " is-open" : ""}`}
          data-log-open={logOpenMobile ? "1" : "0"}
        >
          <section aria-label={copy.turnPanel} className="tidewell-turn-panel tidewell-turn-card">
            <div className="tidewell-turn-card-head">
              <h2 className="tidewell-panel-title">{copy.turnPanel}</h2>
              {ISLAND_FLOURISH_URL ? (
                <img
                  alt=""
                  className="tidewell-turn-flourish"
                  height={56}
                  src={ISLAND_FLOURISH_URL}
                  width={72}
                />
              ) : null}
            </div>
            <p className="tidewell-turn-blurb">{statusLine}</p>
            <p className="tidewell-hud-dice">{diceLine}</p>
            {primaryCta ? (
              <button
                className="tidewell-primary-cta"
                disabled={busy}
                onClick={() =>
                  onAct?.(
                    primaryCta.type,
                    primaryCta.payload
                      ? ({ ...primaryCta.payload } as Record<string, unknown>)
                      : undefined,
                  )
                }
                type="button"
              >
                {shortLabelForAction(primaryCta, copy, resourceLabel)}
              </button>
            ) : (
              <p className="tidewell-turn-idle">{copy.waiting}</p>
            )}
            {primaryActions.length > 1 && (
              <ul
                aria-label={copy.primary}
                className="tidewell-action-row hex-settlement-primary-actions"
              >
                {primaryActions.map((a) => renderActionButton(a, false))}
              </ul>
            )}
          </section>

          <section aria-label={copy.chronicle} className="tidewell-log-panel">
            <div className="tidewell-log-tabs" role="tablist">
              {(
                [
                  ["chronicle", copy.chronicle],
                  ["chat", copy.chat],
                  ["coach", copy.coach],
                ] as const
              ).map(([id, label]) => (
                <button
                  aria-selected={logTab === id}
                  className={logTab === id ? "is-active" : ""}
                  key={id}
                  onClick={() => setLogTab(id)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="tidewell-log-body" role="tabpanel">
              {logTab === "chronicle" ? (
                <ol className="tidewell-chronicle">
                  {chronicleLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              ) : (
                <p className="tidewell-log-empty">
                  {logTab === "chat" ? copy.chat : copy.coach}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <footer aria-label={copy.yourHand} className="tidewell-dock">
<div className="tidewell-hand">
          {(Object.keys(resourceLabel) as Resource[]).map((resource) => {
            const count = viewerResources?.[resource] ?? 0;
            const gain = resourceGain[resource];
            return (
              <div className="tidewell-resource-tile" key={resource}>
                {RESOURCE_CARD_URL[resource] ? (
                  <img
                    alt=""
                    className="tidewell-resource-art"
                    height={120}
                    src={RESOURCE_CARD_URL[resource]}
                    width={90}
                  />
                ) : (
                  <div className="tidewell-resource-art is-fallback">
                    <InkIcon id={RESOURCE_ICON_ID[resource] ?? "icon-res-wood"} />
                  </div>
                )}
                <span className="tidewell-resource-name">{resourceLabel[resource]}</span>
                <b className="tidewell-resource-count">{count}</b>
                {gain ? (
                  <span aria-live="polite" className="tidewell-resource-pop">
                    +{gain}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="tidewell-dev-slot">
          <span className="tidewell-kicker">{copy.devCards}</span>
          <strong>{viewer?.devCards.length ?? 0}</strong>
        </div>

        <div className="tidewell-build-row" role="group" aria-label={copy.primary}>
          {BUILD_COSTS.map((build) => {
            const can = hasLegal(build.type);
            return (
              <button
                className={`tidewell-build-btn${can ? "" : " is-disabled"}`}
                disabled={!can || busy}
                key={build.id}
                onClick={() => {
                  if (build.type === "buy_dev") fireFirst("buy_dev");
                  else {
                    setBoardTargetsOpen(true);
                    fireFirst(build.type);
                  }
                }}
                type="button"
              >
                {BUILD_ICON_URL[build.id] ? (
                  <img
                    alt=""
                    className="tidewell-build-art"
                    height={48}
                    src={BUILD_ICON_URL[build.id]}
                    width={48}
                  />
                ) : null}
                <span className="tidewell-build-label">{build.label}</span>
                <span className="tidewell-build-cost" aria-label={copy.cost}>
                  {build.cost.map((r, i) => (
                    <img
                      alt={resourceLabel[r]}
                      height={16}
                      key={`${build.id}-${r}-${i}`}
                      src={
                        RESOURCE_AI_ICON_URL[r] ??
                        RESOURCE_CARD_URL[r] ??
                        ""
                      }
                      width={16}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </footer>

      <div className="tidewell-mobile-bar">
        <button
          className="tidewell-table-toggle"
          onClick={() => setTableOpen((v) => !v)}
          type="button"
        >
          {tableOpen ? copy.closeTable : copy.table}
        </button>
        {primaryCta ? (
          <button
            className="tidewell-primary-cta"
            disabled={busy}
            onClick={() =>
              onAct?.(
                primaryCta.type,
                primaryCta.payload
                  ? ({ ...primaryCta.payload } as Record<string, unknown>)
                  : undefined,
              )
            }
            type="button"
          >
            {shortLabelForAction(primaryCta, copy, resourceLabel)}
          </button>
        ) : (
          <p className="tidewell-turn-idle" style={{ flex: 1, margin: 0 }}>
            {copy.waiting}
          </p>
        )}
      </div>

      <div
        aria-hidden={tableOpen ? undefined : true}
        className={`tidewell-table-sheet${tableOpen ? " is-open" : ""}`}
      >
        <div className="tidewell-table-sheet-head">
          <strong>{copy.table}</strong>
          <button
            className="tidewell-chip-btn"
            onClick={() => setTableOpen(false)}
            type="button"
          >
            {copy.closeTable}
          </button>
        </div>
<div className="tidewell-hand">
          {(Object.keys(resourceLabel) as Resource[]).map((resource) => {
            const count = viewerResources?.[resource] ?? 0;
            const gain = resourceGain[resource];
            return (
              <div className="tidewell-resource-tile" key={resource}>
                {RESOURCE_CARD_URL[resource] ? (
                  <img
                    alt=""
                    className="tidewell-resource-art"
                    height={120}
                    src={RESOURCE_CARD_URL[resource]}
                    width={90}
                  />
                ) : (
                  <div className="tidewell-resource-art is-fallback">
                    <InkIcon id={RESOURCE_ICON_ID[resource] ?? "icon-res-wood"} />
                  </div>
                )}
                <span className="tidewell-resource-name">{resourceLabel[resource]}</span>
                <b className="tidewell-resource-count">{count}</b>
                {gain ? (
                  <span aria-live="polite" className="tidewell-resource-pop">
                    +{gain}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="tidewell-dev-slot">
          <span className="tidewell-kicker">{copy.devCards}</span>
          <strong>{viewer?.devCards.length ?? 0}</strong>
        </div>

        <div className="tidewell-build-row" role="group" aria-label={copy.primary}>
          {BUILD_COSTS.map((build) => {
            const can = hasLegal(build.type);
            return (
              <button
                className={`tidewell-build-btn${can ? "" : " is-disabled"}`}
                disabled={!can || busy}
                key={build.id}
                onClick={() => {
                  if (build.type === "buy_dev") fireFirst("buy_dev");
                  else {
                    setBoardTargetsOpen(true);
                    fireFirst(build.type);
                  }
                }}
                type="button"
              >
                {BUILD_ICON_URL[build.id] ? (
                  <img
                    alt=""
                    className="tidewell-build-art"
                    height={48}
                    src={BUILD_ICON_URL[build.id]}
                    width={48}
                  />
                ) : null}
                <span className="tidewell-build-label">{build.label}</span>
                <span className="tidewell-build-cost" aria-label={copy.cost}>
                  {build.cost.map((r, i) => (
                    <img
                      alt={resourceLabel[r]}
                      height={16}
                      key={`${build.id}-${r}-${i}`}
                      src={
                        RESOURCE_AI_ICON_URL[r] ??
                        RESOURCE_CARD_URL[r] ??
                        ""
                      }
                      width={16}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legacy resource list (hidden) for older CSS/tests that query it */}
      {viewerResources && (
        <div aria-label={copy.resources} className="tidewell-hud-resources sr-only">
          <span className="tidewell-kicker">{copy.resources}</span>
          <ul>
            {(Object.keys(resourceLabel) as Resource[]).map((resource) => (
              <li key={resource}>
                <InkIcon
                  className="tidewell-ink-icon"
                  id={RESOURCE_ICON_ID[resource] ?? "icon-res-wood"}
                />
                <span>{resourceLabel[resource]}</span>
                <b>{viewerResources[resource] ?? 0}</b>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Accessible board-target drawer — required by e2e helpers */}
      <div className="hex-settlement-actions">
        {targetActions.length > 0 && (
          <details
            className="hex-settlement-board-targets"
            open={boardTargetsOpen}
            onToggle={(event) =>
              setBoardTargetsOpen((event.currentTarget as HTMLDetailsElement).open)
            }
          >
            <summary>{copy.boardTargets}</summary>
            <ul
              aria-label={copy.boardTargets}
              className="hex-settlement-action-list"
            >
              {targetActions.map((a) => renderActionButton(a, true))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
