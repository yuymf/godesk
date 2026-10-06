import { lazy, Suspense, useCallback, useMemo } from "react";
import type { Resource } from "../runtime/adapters/hex-island";
import type { LegalAction } from "../runtime/play-kernel";
import {
  listHexIslandLegalActionsForSession,
  type HexSettlementBoardState,
} from "./hex-settlement-session";
import type { RoomLocale } from "./room-presentation";

export type { HexSettlementBoardState } from "./hex-settlement-session";

const LazySceneHost = lazy(async () => {
  const mod = await import("../render3d");
  return { default: mod.SceneHost };
});

const SEAT_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12"] as const;

const RESOURCE_LABEL = {
  zh: { wood: "木", brick: "砖", sheep: "羊", wheat: "麦", ore: "矿" },
  en: { wood: "Wood", brick: "Brick", sheep: "Sheep", wheat: "Wheat", ore: "Ore" },
} as const;

const COPY = {
  zh: {
    board: "汐屿六角岛",
    hud: "对局状态",
    active: "当前行动",
    seat: "座位",
    phase: "阶段",
    dice: "骰子",
    noDice: "尚未掷骰",
    resources: "你的资源",
    vp: "胜利点",
    robber: "强盗",
    longestRoad: "最长道路",
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
    placeSettlement: "放置定居点",
    placeCity: "升级城市",
    placeRoad: "放置道路",
    moveRobber: "移动强盗",
    actions: "可用行动",
  },
  en: {
    board: "hex-island hex island",
    hud: "Match status",
    active: "Active seat",
    seat: "Seat",
    phase: "Phase",
    dice: "Dice",
    noDice: "No roll yet",
    resources: "Your resources",
    vp: "VP",
    robber: "Robber",
    longestRoad: "Longest road",
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
    placeSettlement: "Place settlement",
    placeCity: "Upgrade city",
    placeRoad: "Place road",
    moveRobber: "Move robber",
    actions: "Available actions",
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
    robber: { zh: "移动强盗", en: "Robber" },
    main: { zh: "建造/贸易", en: "Build / trade" },
    ended: { zh: "结束", en: "Ended" },
  };
  return map[phase]?.[locale] ?? phase;
}

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

/**
 * G3D-04 Room surface: 3D SceneHost + HUD + accessible legal-action list.
 * No SVG board, no 2D fallback.
 */
export function HexSettlementBoard({
  hexIsland,
  activeSeat,
  viewerSeat,
  status,
  enabled,
  locale = "zh",
  winnerSeat = null,
  busy = false,
  aiSeats = [],
  onAct,
}: {
  hexIsland: HexSettlementBoardState;
  activeSeat: number;
  viewerSeat: number | null;
  status: "active" | "complete";
  enabled: boolean;
  locale?: RoomLocale;
  winnerSeat?: number | null;
  busy?: boolean;
  /** G3D-04b: seats driven server-side by the kernel bot. */
  aiSeats?: number[];
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const copy = COPY[locale];
  const resourceLabel = RESOURCE_LABEL[locale];
  const interactive =
    enabled && status === "active" && Boolean(onAct) && !busy;
  const legalPlayer =
    interactive && viewerSeat !== null ? viewerSeat : activeSeat;
  const legalActions = useMemo(
    () =>
      status === "active"
        ? listHexIslandLegalActionsForSession({
            hexIsland,
            activeSeat,
            status,
            playerId: legalPlayer,
          })
        : [],
    [hexIsland, activeSeat, status, legalPlayer],
  );
  const showLegal =
    interactive && viewerSeat !== null && viewerSeat === activeSeat;

  const vpScores = useMemo(
    () =>
      hexIsland.players.map((player, seat) => {
        let points =
          player.settlements.length + player.cities.length * 2 + player.vpCards;
        if (hexIsland.longestRoadOwner === seat) points += 2;
        if (hexIsland.largestArmyOwner === seat) points += 2;
        return points;
      }),
    [hexIsland],
  );

  const viewerResources =
    viewerSeat !== null ? hexIsland.players[viewerSeat]?.resources : null;

  const statusLine =
    status === "complete"
      ? `${copy.gameOver}${winnerSeat !== null ? ` · ${copy.winner} ${winnerSeat}` : ""}`
      : viewerSeat !== null && viewerSeat === activeSeat
        ? copy.yourTurn
        : aiSeats.includes(activeSeat)
          ? `${copy.aiThinking} · ${copy.seat} ${activeSeat}`
          : `${copy.waiting} · ${copy.seat} ${activeSeat}`;
  const diceLine =
    hexIsland.lastDice === null
      ? copy.noDice
      : `${copy.dice} ${hexIsland.lastDice[0]} + ${hexIsland.lastDice[1]} = ${hexIsland.lastDice[0] + hexIsland.lastDice[1]}`;

  const accessibleActions = showLegal ? legalActions : [];

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

  return (
    <div
      aria-label={copy.board}
      className="hex-island-board hex-settlement-board"
      data-status={status}
      role="region"
    >
      <section aria-label={copy.hud} className="hex-island-hud">
        <div className="hex-island-hud-status">
          <span className="hex-island-kicker">{copy.active}</span>
          <strong>
            {copy.seat} {activeSeat} · {copy.phase} {phaseLabel(hexIsland.phase, locale)}
          </strong>
          <p>{statusLine}</p>
          <p className="hex-island-hud-dice">{diceLine}</p>
        </div>
        <div className="hex-island-hud-scores" aria-label={copy.vp}>
          {vpScores.map((vp, seat) => (
            <div
              className={`hex-island-score${seat === activeSeat ? " is-active" : ""}`}
              key={`vp-${seat}`}
            >
              <span
                aria-hidden="true"
                className="hex-island-seat-swatch"
                style={{ background: SEAT_COLORS[seat % SEAT_COLORS.length] }}
              />
              <b>
                {copy.seat} {seat} · {vp} {copy.vp}
              </b>
            </div>
          ))}
        </div>
        {viewerResources && (
          <div aria-label={copy.resources} className="hex-island-hud-resources">
            <span className="hex-island-kicker">{copy.resources}</span>
            <ul>
              {(Object.keys(resourceLabel) as Resource[]).map((resource) => (
                <li key={resource}>
                  <span>{resourceLabel[resource]}</span>
                  <b>{viewerResources[resource] ?? 0}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="hex-island-hud-awards">
          <div>
            <dt>{copy.robber}</dt>
            <dd>{hexIsland.robberHex}</dd>
          </div>
          <div>
            <dt>{copy.longestRoad}</dt>
            <dd>
              {hexIsland.longestRoadOwner === null
                ? copy.none
                : `${copy.seat} ${hexIsland.longestRoadOwner}`}
            </dd>
          </div>
          <div>
            <dt>{copy.largestArmy}</dt>
            <dd>
              {hexIsland.largestArmyOwner === null
                ? copy.none
                : `${copy.seat} ${hexIsland.largestArmyOwner}`}
            </dd>
          </div>
          <div>
            <dt>{copy.lastAction}</dt>
            <dd>{hexIsland.lastAction ?? copy.noLast}</dd>
          </div>
        </dl>
      </section>

      <div className="g3d-stage">
        <Suspense fallback={<div aria-busy="true">加载 3D 桌面…</div>}>
          <LazySceneHost
            ariaLabel={copy.board}
            className="room-g3d-scene-host"
            hexSettlement={hexIsland}
            activeSeat={activeSeat}
            interactive={showLegal}
            legalActions={pickableActions}
            onPick={handlePick}
          />
        </Suspense>
      </div>

      {accessibleActions.length > 0 && (
        <ul aria-label={copy.actions} className="hex-island-action-row hex-settlement-action-list">
          {accessibleActions.map((action) => (
            <li key={actionKey(action)}>
              <button
                aria-label={labelForBoardAction(action, copy, resourceLabel)}
                className="hex-island-action"
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
                {labelForBoardAction(action, copy, resourceLabel)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
