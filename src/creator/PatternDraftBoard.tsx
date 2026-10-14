import type { SessionState } from "./project-contract";

type PatternDraftBoardState = NonNullable<SessionState["patternDraft"]>;

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
}: {
  draft: PatternDraftBoardState;
  activeSeat: number;
  enabled: boolean;
  busy?: boolean;
  readOnly?: boolean;
  status: "active" | "complete";
  viewerSeat: number | null;
  onAct?: (actionId: string, payload?: Record<string, unknown>) => void;
}) {
  const canAct =
    enabled && !busy && !readOnly && status === "active" && viewerSeat === activeSeat;
  const own = viewerSeat !== null ? draft.seats[viewerSeat] : null;

  const draftFromFactory = (factoryId: number, color: string, line: number | "floor") => {
    onAct?.("draft", { source: "factory", factoryId, color, line });
  };
  const draftFromCenter = (color: string, line: number | "floor") => {
    onAct?.("draft", { source: "center", color, line });
  };

  return (
    <section aria-label="瓷砖工坊桌" className="pattern-draft-board" data-end-bonuses="row2-col7-color10">
      <header>
        <span className="auction-kicker">工厂草稿 · 第 {draft.round} 轮</span>
        <h2>
          {status === "complete"
            ? `终局 · 座位 ${draft.seats[0].score >= draft.seats[1].score ? 0 : 1} 领先`
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
        {([0, 1] as const).map((seat) => {
          const s = draft.seats[seat];
          return (
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
          );
        })}
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
