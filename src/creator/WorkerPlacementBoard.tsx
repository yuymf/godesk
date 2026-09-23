import {
  canPlaceWorker,
  workerPlacementInstruction,
  type WorkerPlacementState,
} from "../runtime/worker-placement";

export function WorkerPlacementBoard({
  board,
  busy,
  onAct,
  readOnly = false,
}: {
  board: WorkerPlacementState;
  busy?: boolean;
  onAct?: (actionId: string) => void;
  readOnly?: boolean;
}) {
  const interactive = !readOnly && Boolean(onAct) && board.phase !== "resolved";

  return (
    <div className="worker-placement-board">
      <p className="worker-placement-instruction">
        {workerPlacementInstruction(board)}
      </p>
      <div className="worker-placement-regions" role="list">
        {board.regions.map((region) => {
          const occupied = board.placements.filter(
            (placement) => placement.regionId === region.id,
          );
          const canPlace =
            interactive &&
            canPlaceWorker(board, board.activeSeat, region.id);
          return (
            <article
              className={`worker-placement-region ${canPlace ? "is-open" : ""}`}
              key={region.id}
              role="listitem"
            >
              <header>
                <b>{region.name}</b>
                <small>
                  容量 {occupied.length}/{region.capacity}
                  {region.cost > 0 ? ` · 费用 ${region.cost}` : ""}
                  {(region.yieldWood ?? 0) > 0
                    ? ` · 木材 +${region.yieldWood}`
                    : (region.convertWoodToBuilding ?? 0) > 0
                      ? ` · 兑换 ${region.convertWoodToBuilding} 木材→建筑`
                      : region.resolvePoints > 0
                        ? ` · 结算 ${region.resolvePoints}`
                        : ""}
                </small>
              </header>
              <div className="worker-placement-slots" aria-label={`${region.name} 占用`}>
                {Array.from({ length: region.capacity }, (_, index) => {
                  const placement = occupied[index];
                  const owner = placement
                    ? board.players.find((player) => player.seat === placement.seat)
                    : null;
                  return (
                    <span
                      className={owner ? "is-filled" : ""}
                      key={`${region.id}-slot-${index}`}
                      style={owner ? { background: owner.color } : undefined}
                      title={owner ? owner.name : "空位"}
                    />
                  );
                })}
              </div>
              {interactive && (
                <button
                  disabled={busy || !canPlace}
                  onClick={() => onAct?.(`place:${region.id}`)}
                  type="button"
                >
                  放置到{region.name}
                </button>
              )}
            </article>
          );
        })}
      </div>
      <div className="worker-placement-seats">
        {board.players.map((player) => (
          <div
            className={
              board.activeSeat === player.seat && board.phase === "placement"
                ? "is-active"
                : ""
            }
            key={player.seat}
          >
            <span style={{ background: player.color }} />
            <b>{player.name}</b>
            <small>
              工人 {player.workers}
              {board.victoryBuildings != null
                ? ` · 木材 ${player.wood} · 建筑 ${player.buildings}`
                : ` · 分 ${player.score}`}
              {player.coins > 0 ? ` · 币 ${player.coins}` : ""}
            </small>
          </div>
        ))}
      </div>
      <aside className="game-log" aria-label="放置记录">
        <ol>
          {board.log.slice(-8).map((line, index) => (
            <li key={`${index}-${line.slice(0, 12)}`}>{line}</li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
