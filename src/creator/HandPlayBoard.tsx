import type { RoomLocale } from "./room-presentation";

type HandPlayBoardState = {
  playerCount: number;
  deckRemaining: number;
  hands: number[][];
  playArea: Array<{ seat: number; card: number }>;
  lastPlay: { seat: number; card: number } | null;
};

const COPY = {
  zh: {
    board: "手牌与出牌区",
    hud: "对局状态",
    active: "当前行动",
    seat: "座位",
    scores: "分数",
    deck: "牌库剩余",
    cardsUnit: "张",
    playArea: "出牌区",
    playAreaEmpty: "尚无出牌",
    lastPlay: "最近打出",
    noLast: "尚无行动",
    ownHand: "你的手牌",
    handEmpty: "空手牌",
    handCard: "手牌",
    played: "打出",
    gameOver: "对局结束",
    winner: "获胜者",
    tied: "平局",
    yourTurn: "轮到你出牌",
    waiting: "等待对方",
    hint: "打出手牌点数累加分数，先到目标分获胜",
  },
  en: {
    board: "Hand and play area",
    hud: "Match status",
    active: "Active seat",
    seat: "Seat",
    scores: "Scores",
    deck: "Deck remaining",
    cardsUnit: "cards",
    playArea: "Play area",
    playAreaEmpty: "No cards played yet",
    lastPlay: "Last play",
    noLast: "No moves yet",
    ownHand: "Your hand",
    handEmpty: "Empty hand",
    handCard: "Card",
    played: "played",
    gameOver: "Game over",
    winner: "Winner",
    tied: "Tie",
    yourTurn: "Your turn to play",
    waiting: "Waiting for opponent",
    hint: "Play card values to score; first to the target wins",
  },
} as const;

const SEAT_COLOR = ["#b45309", "#0369a1", "#15803d", "#7c3aed"] as const;

/**
 * Cards-surface HUD for hand-play-v1 (not a spatial board).
 * Mirrors othello/hexIsland/network HUD readability: status, scores, log, hand.
 */
export function HandPlayBoard({
  handPlay,
  scores,
  activeSeat,
  viewerSeat,
  status,
  locale = "zh",
  winnerSeat = null,
}: {
  handPlay: HandPlayBoardState;
  scores: number[];
  activeSeat: number;
  viewerSeat: number | null;
  status: "active" | "complete";
  locale?: RoomLocale;
  winnerSeat?: number | null;
}) {
  const copy = COPY[locale];
  const statusLine =
    status === "complete"
      ? winnerSeat === null
        ? `${copy.gameOver} · ${copy.tied}`
        : `${copy.gameOver} · ${copy.winner} ${copy.seat} ${winnerSeat}`
      : viewerSeat !== null && viewerSeat === activeSeat
        ? copy.yourTurn
        : `${copy.waiting} · ${copy.seat} ${activeSeat}`;

  const lastLine = handPlay.lastPlay
    ? `${copy.lastPlay} · ${copy.seat} ${handPlay.lastPlay.seat} · ${handPlay.lastPlay.card}`
    : copy.noLast;

  const ownHand =
    viewerSeat !== null ? (handPlay.hands[viewerSeat] ?? []) : null;

  return (
    <div
      aria-label={copy.board}
      className="hand-play-board"
      data-status={status}
      role="region"
    >
      <section aria-label={copy.hud} className="hand-play-hud">
        <div className="hand-play-hud-status">
          <span className="hand-play-kicker">{copy.active}</span>
          <strong>
            {copy.seat} {activeSeat}
          </strong>
          <p>{statusLine}</p>
          <p className="hand-play-hint">{copy.hint}</p>
        </div>
        <div className="hand-play-hud-scores" aria-label={copy.scores}>
          {scores.map((score, seat) => (
            <div className="hand-play-score" key={`score-${seat}`}>
              <span
                aria-hidden="true"
                className="hand-play-swatch"
                style={{
                  background: SEAT_COLOR[seat % SEAT_COLOR.length],
                }}
              />
              <b>
                {copy.seat} {seat} · {score}
              </b>
            </div>
          ))}
        </div>
        <p className="hand-play-hud-deck" aria-label={copy.deck}>
          {copy.deck} {handPlay.deckRemaining} {copy.cardsUnit}
        </p>
        <p className="hand-play-hud-last">{lastLine}</p>
      </section>

      <div aria-label={copy.playArea} className="hand-play-play-area" role="log">
        <span className="hand-play-kicker">{copy.playArea}</span>
        {handPlay.playArea.length === 0 ? (
          <strong className="hand-play-empty">{copy.playAreaEmpty}</strong>
        ) : (
          <ul className="hand-play-play-log">
            {handPlay.playArea.map((entry, index) => (
              <li key={`${entry.seat}-${entry.card}-${index}`}>
                <span
                  aria-hidden="true"
                  className="hand-play-card-chip"
                  style={{
                    borderColor: SEAT_COLOR[entry.seat % SEAT_COLOR.length],
                  }}
                >
                  {entry.card}
                </span>
                <span>
                  {copy.seat} {entry.seat} {copy.played} {entry.card}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ownHand !== null && (
        <div aria-label={copy.ownHand} className="hand-play-own-hand">
          <span className="hand-play-kicker">{copy.ownHand}</span>
          <div className="own-hand">
            {ownHand.length === 0 ? (
              <strong className="hand-play-empty">{copy.handEmpty}</strong>
            ) : (
              ownHand.map((card, index) => (
                <span
                  className="hand-play-hand-card"
                  key={`${card}-${index}`}
                >
                  {copy.handCard} {card}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
