import type { SessionState } from "./project-contract";
import type { RenderSpec } from "./render-spec";
import { TabletopStage } from "./TabletopStage";
import {
  createPatternDraftKernelConfig,
  parsePatternDraftConfig,
  patternDraftAdapter,
  type PatternDraftGenre,
} from "../runtime/adapters/pattern-draft";
import type { PlayState } from "../runtime/play-kernel";

type PatternDraftBoardState = NonNullable<SessionState["patternDraft"]>;

function playStateFromPatternSession(
  draft: PatternDraftBoardState,
  activeSeat: number,
  status: "active" | "complete",
): PlayState<PatternDraftGenre> {
  const genre = draft as unknown as PatternDraftGenre;
  return {
    seed: 0,
    sequence: 0,
    phase: status === "complete" ? "ended" : "draft",
    activePlayerId: activeSeat,
    playerCount: genre.seats.length,
    status,
    winnerId: null,
    events: [],
    genre,
  };
}

export function listPatternDraftLegalActionsForSession(input: {
  draft: PatternDraftBoardState;
  activeSeat: number;
  status: "active" | "complete";
  playerId: number;
}) {
  const config = createPatternDraftKernelConfig({ playerCount: Math.max(2, input.draft.seats.length) });
  const parsed = parsePatternDraftConfig(config.adapter);
  if (!parsed) return [];
  const state = playStateFromPatternSession(input.draft, input.activeSeat, input.status);
  return patternDraftAdapter.listLegalActions(state, input.playerId, parsed);
}

const COLOR_LABEL: Record<string, string> = {
  blue: "蓝", yellow: "黄", red: "红", black: "黑", white: "白",
};

export function PatternDraftBoard({
  draft,
  activeSeat,
  enabled,
  busy = false,
  readOnly = false,
  status,
  viewerSeat,
  onAct,
  render,
  importedModels,
}: {
  draft: PatternDraftBoardState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
  /** ADR 0014 / T027: optional RenderSpec for shared TabletopStage. */
  render?: RenderSpec;
  importedModels?: ReadonlyArray<{ id: string; url: string; title?: string }>;
}) {
  const canAct =
    enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  const own = viewerSeat !== null ? draft.seats[viewerSeat] : null;
  const seats = draft.seats as Array<{
    lines: Array<{ color: string | null; tiles: string[]; capacity: number }>;
    wall: Array<Array<string | null>>;
    floor: string[];
    hasMarker: boolean;
    score: number;
  }>;
  const leader = seats.reduce(
    (best, seat, index) => (seat.score > (seats[best]?.score ?? -Infinity) ? index : best),
    0,
  );

  const draftFromFactory = (factoryId: number, color: string, line: number | "floor") => {
    onAct?.("draft", { source: "factory", factoryId, color, line });
  };
  const draftFromCenter = (color: string, line: number | "floor") => {
    onAct?.("draft", { source: "center", color, line });
  };

  const stageOnAct = canAct
    ? (actionId: string, payload?: Record<string, unknown>) => {
        onAct?.(actionId, payload);
      }
    : undefined;
  const legalActions = canAct
    ? listPatternDraftLegalActionsForSession({
        draft,
        activeSeat,
        status,
        playerId: viewerSeat ?? activeSeat,
      })
    : [];

  return (
    <section
      aria-label="瓷砖工坊桌"
      className="pattern-draft-board room-view-tabletop-immersive"
      data-end-bonuses="row2-col7-color10"
    >
      <TabletopStage
        kernel="pattern-draft-v1"
        state={draft}
        legal={legalActions}
        render={render}
        importedModels={importedModels}
        onAct={stageOnAct}
      />
      <header>
        <span className="auction-kicker">工厂草稿 · 第 {draft.round} 轮</span>
        <h2>
          {status === "complete"
            ? `终局 · 座位 ${leader} 领先`
            : `轮到座位 ${activeSeat} 拿色`}
        </h2>
        <p aria-label="pattern-bag">
          袋 {draft.bagCount ?? draft.bag?.length ?? 0} · 盖 {draft.lidCount ?? draft.lid?.length ?? 0}
          {draft.markerInCenter ? " · 先手标记在中心" : ""}
        </p>
      </header>
      <div role="region" aria-label="工厂展示">
        {draft.factories.map((factory, fi) => {
          const colors = [...new Set(factory)];
          return (
            <div key={fi}>
              <strong>工厂 {fi}</strong>
              <span> {factory.map((c) => COLOR_LABEL[c] ?? c).join("")} </span>
              {canAct &&
                colors.map((color) =>
                  ([0, 1, 2, 3, 4] as const).map((line) => (
                    <button
                      key={`${fi}-${color}-${line}`}
                      type="button"
                      onClick={() => draftFromFactory(fi, color, line)}
                    >
                      {COLOR_LABEL[color]}→行{line + 1}
                    </button>
                  )),
                )}
              {canAct &&
                colors.map((color) => (
                  <button
                    key={`${fi}-${color}-floor`}
                    type="button"
                    onClick={() => draftFromFactory(fi, color, "floor")}
                  >
                    {COLOR_LABEL[color]}→地板
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      <div role="region" aria-label="中心堆">
        <strong>中心</strong>
        <span> {draft.center.map((c) => COLOR_LABEL[c] ?? c).join("") || "空"} </span>
        {canAct &&
          [...new Set(draft.center)].map((color) =>
            ([0, 1, 2, 3, 4] as const).map((line) => (
              <button
                key={`c-${color}-${line}`}
                type="button"
                onClick={() => draftFromCenter(color, line)}
              >
                {COLOR_LABEL[color]}→行{line + 1}
              </button>
            )),
          )}
      </div>
      <div role="region" aria-label="席位">
        {seats.map((s, seat) => (
          <div key={seat} className={seat === activeSeat ? "is-active" : ""}>
            <strong>座位 {seat}</strong> 分 {s.score}
            {s.hasMarker ? " · 先手" : ""}
            <div>
              准备行：
              {s.lines.map((line, i) => (
                <span key={i}>
                  [{i + 1}:{line.tiles.map((t) => COLOR_LABEL[t] ?? t).join("") || "·"}]
                </span>
              ))}
            </div>
            <div>
              地板：{s.floor.map((t) => COLOR_LABEL[t] ?? t).join("") || "空"}
            </div>
          </div>
        ))}
      </div>
      {own ? (
        <p aria-label="own-wall">
          你的墙已贴{" "}
          {own.wall.flat().filter(Boolean).length}/25
        </p>
      ) : null}
    </section>
  );
}
