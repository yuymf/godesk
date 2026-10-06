import type { CSSProperties } from "react";
import {
  createOthelloKernelConfig,
  othelloAdapter,
  parseOthelloConfig,
  type OthelloCell,
  type OthelloGenre,
} from "../runtime/adapters/othello";
import type { PlayState } from "../runtime/play-kernel";
import type { RoomLocale } from "./room-presentation";
import type { RenderSpec } from "./render-spec";
import { TabletopStage } from "./TabletopStage";

type OthelloBoardState = {
  rows: number;
  cols: number;
  board: Array<Array<number | null>>;
  consecutivePasses: number;
  discCounts: [number, number];
  lastMove: { row: number; col: number; flipped: number } | null;
  lastAction: "place" | "pass" | null;
};

const COPY = {
  zh: {
    board: "黑白棋盘",
    hud: "对局状态",
    active: "当前行动",
    seat: "座位",
    black: "黑",
    white: "白",
    discs: "子数",
    lastMove: "最近落子",
    lastPass: "最近停着",
    noLast: "尚无行动",
    flipped: "翻子",
    pass: "停着（无合法落子）",
    gameOver: "对局结束",
    winner: "获胜者",
    tied: "平局",
    yourTurn: "轮到你落子",
    waiting: "等待对方",
    empty: "空位",
    legal: "可落子",
    disc: "棋子",
  },
  en: {
    board: "Othello board",
    hud: "Match status",
    active: "Active seat",
    seat: "Seat",
    black: "Black",
    white: "White",
    discs: "discs",
    lastMove: "Last place",
    lastPass: "Last pass",
    noLast: "No moves yet",
    flipped: "flipped",
    pass: "Pass (no legal place)",
    gameOver: "Game over",
    winner: "Winner",
    tied: "Tie",
    yourTurn: "Your turn to place",
    waiting: "Waiting for opponent",
    empty: "Empty",
    legal: "Legal place",
    disc: "disc",
  },
} as const;

function toGenre(othello: OthelloBoardState): OthelloGenre {
  return {
    rows: othello.rows,
    cols: othello.cols,
    board: othello.board as OthelloCell[][],
    consecutivePasses: othello.consecutivePasses,
    discCounts: [...othello.discCounts] as [number, number],
    lastMove: othello.lastMove ? { ...othello.lastMove } : null,
    lastAction: othello.lastAction,
  };
}

/** Rebuild a minimal PlayState so client-side listLegalActions matches the adapter. */
function playStateFromOthelloSession(
  othello: OthelloBoardState,
  activeSeat: number,
  status: "active" | "complete",
  winnerSeat: number | null = null,
): PlayState<OthelloGenre> {
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : "play",
    activePlayerId: activeSeat,
    playerCount: 2,
    status,
    winnerId: winnerSeat,
    events: [],
    genre: toGenre(othello),
  };
}

export function listOthelloLegalActionsForSession(input: {
  othello: OthelloBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createOthelloKernelConfig({
    rows: input.othello.rows,
    cols: input.othello.cols,
  });
  const parsed = parseOthelloConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromOthelloSession(
    input.othello,
    input.activeSeat,
    input.status,
  );
  return othelloAdapter.listLegalActions(state, input.playerId, parsed);
}

function cellAriaLabel(
  locale: RoomLocale,
  copy: (typeof COPY)[RoomLocale],
  row: number,
  col: number,
  owner: number | null,
  legal: boolean,
): string {
  const coord =
    locale === "zh"
      ? `第 ${row + 1} 行第 ${col + 1} 列`
      : `row ${row + 1} column ${col + 1}`;
  if (owner === 0) return `${copy.black}${copy.disc} · ${coord}`;
  if (owner === 1) return `${copy.white}${copy.disc} · ${coord}`;
  if (legal) return `${copy.legal} · ${coord}`;
  return `${copy.empty} · ${coord}`;
}

export function OthelloBoard({
  othello,
  activeSeat,
  viewerSeat,
  status,
  enabled,
  readOnly = false,
  locale = "zh",
  winnerSeat = null,
  busy = false,
  onAct,
  render,
}: {
  othello: OthelloBoardState;
  activeSeat: number;
  viewerSeat: number | null;
  status: "active" | "complete";
  enabled: boolean;
  readOnly?: boolean;
  locale?: RoomLocale;
  winnerSeat?: number | null;
  busy?: boolean;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
  /** G3D-14：build.ruleSystem.presentation.render（缺省用平台默认）。 */
  render?: RenderSpec;
}) {
  const copy = COPY[locale];
  const interactive =
    !readOnly && enabled && status === "active" && Boolean(onAct) && !busy;
  const legalPlayer =
    interactive && viewerSeat !== null ? viewerSeat : activeSeat;
  const legalActions =
    status === "active"
      ? listOthelloLegalActionsForSession({
          othello,
          activeSeat,
          status,
          playerId: legalPlayer,
        })
      : [];
  const legalPlaces = new Set(
    legalActions
      .filter((action) => action.type === "place")
      .map((action) => {
        const row = action.payload?.row;
        const col = action.payload?.col;
        return Number.isInteger(row) && Number.isInteger(col)
          ? `${row as number},${col as number}`
          : "";
      })
      .filter(Boolean),
  );
  const onlyPass =
    interactive &&
    legalActions.length > 0 &&
    legalActions.every((action) => action.type === "pass");
  const showLegal =
    interactive &&
    viewerSeat !== null &&
    viewerSeat === activeSeat;

  const [black, white] = othello.discCounts;
  const lastLine =
    othello.lastAction === "pass"
      ? copy.lastPass
      : othello.lastMove
        ? `${copy.lastMove} · ${othello.lastMove.row + 1},${othello.lastMove.col + 1} · ${copy.flipped} ${othello.lastMove.flipped}`
        : copy.noLast;

  const statusLine =
    status === "complete"
      ? winnerSeat === null
        ? `${copy.gameOver} · ${copy.tied}`
        : `${copy.gameOver} · ${copy.winner} ${copy.seat} ${winnerSeat} (${winnerSeat === 0 ? copy.black : copy.white})`
      : viewerSeat !== null && viewerSeat === activeSeat
        ? copy.yourTurn
        : `${copy.waiting} · ${copy.seat} ${activeSeat}`;

  return (
    <div
      aria-label={copy.board}
      className="othello-board"
      data-status={status}
      role="region"
    >
      <section aria-label={copy.hud} className="othello-hud">
        <div className="othello-hud-status">
          <span className="othello-kicker">{copy.active}</span>
          <strong>
            {copy.seat} {activeSeat} · {activeSeat === 0 ? copy.black : copy.white}
          </strong>
          <p>{statusLine}</p>
        </div>
        <div className="othello-hud-scores" aria-label={copy.discs}>
          <div className={`othello-score is-black${activeSeat === 0 ? " is-active" : ""}`}>
            <span aria-hidden="true" className="othello-disc-swatch is-black" />
            <b>
              {copy.black} {black}
            </b>
          </div>
          <div className={`othello-score is-white${activeSeat === 1 ? " is-active" : ""}`}>
            <span aria-hidden="true" className="othello-disc-swatch is-white" />
            <b>
              {copy.white} {white}
            </b>
          </div>
        </div>
        <p className="othello-hud-last">{lastLine}</p>
      </section>

      <TabletopStage kernel="disc-flipping-v1" legal={legalActions} onAct={showLegal ? onAct : undefined} render={render} state={othello} />

      <div
        aria-label={copy.board}
        className="othello-grid"
        role="grid"
        style={
          {
            "--othello-cols": String(othello.cols),
          } as CSSProperties
        }
      >
        {othello.board.map((rowCells, row) => (
          <div key={`row-${row}`} role="row" className="othello-row">
            {rowCells.map((owner, col) => {
              const key = `${row},${col}`;
              const legal = showLegal && legalPlaces.has(key);
              const isLast =
                othello.lastMove?.row === row && othello.lastMove?.col === col;
              const clickable = legal && interactive;
              return (
                <button
                  aria-label={cellAriaLabel(
                    locale,
                    copy,
                    row,
                    col,
                    owner,
                    legal,
                  )}
                  className={[
                    "othello-cell",
                    owner === 0 ? "is-black" : "",
                    owner === 1 ? "is-white" : "",
                    legal ? "is-legal" : "",
                    isLast ? "is-last-move" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={!clickable}
                  key={key}
                  onClick={() => {
                    if (!clickable) return;
                    onAct?.("place", { row, col });
                  }}
                  role="gridcell"
                  type="button"
                >
                  {owner !== null && (
                    <span
                      aria-hidden="true"
                      className={`othello-disc ${owner === 0 ? "is-black" : "is-white"}`}
                    />
                  )}
                  {legal && owner === null && (
                    <span aria-hidden="true" className="othello-legal-dot" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {onlyPass && (
        <div className="othello-pass-row">
          <button
            aria-label={copy.pass}
            className="othello-pass"
            disabled={busy}
            onClick={() => onAct?.("pass")}
            type="button"
          >
            {copy.pass}
          </button>
        </div>
      )}
    </div>
  );
}
