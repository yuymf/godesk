import type { PlayableBuild, SessionState } from "./project-contract";
import {
  CARD_SYMBOLS,
  displayActionDescription,
  drawAndScoreKernel,
  pushYourLuckKernel,
  rollAndMoveKernel,
  roomActionTitle,
  scoreRaceKernel,
  sharedGoalKernel,
  takeAwayKernel,
  turnTakingKernel,
  type RoomLocale,
  ROOM_COPY,
} from "./room-presentation";

type RoomCopy = (typeof ROOM_COPY)[RoomLocale];
type RuntimeAction = { id: string; label: string; value: number | null };
type Race = NonNullable<ReturnType<typeof scoreRaceKernel>>;
type SharedGoal = NonNullable<ReturnType<typeof sharedGoalKernel>>;
type TakeAway = NonNullable<ReturnType<typeof takeAwayKernel>>;
type RollAndMove = NonNullable<ReturnType<typeof rollAndMoveKernel>>;
type DrawAndScore = NonNullable<ReturnType<typeof drawAndScoreKernel>>;
type PushYourLuck = NonNullable<ReturnType<typeof pushYourLuckKernel>>;
type TurnTaking = NonNullable<ReturnType<typeof turnTakingKernel>>;

function ScoreTrackBar({
  ariaLabel,
  filled,
  trackLength,
}: {
  ariaLabel: string;
  filled: number;
  trackLength: number;
}) {
  return (
    <div aria-label={ariaLabel} className="score-track">
      {Array.from({ length: trackLength }, (_, index) => (
        <span className={index < filled ? "filled" : ""} key={index} />
      ))}
    </div>
  );
}

/**
 * Honest scoreboard Play Surface for score-track-family kernels only.
 * Genre rooms (hidden-role / hand-play / conversation / harbor) must not mount this
 * (ADR 0012 surface fidelity).
 */
export function ScoreTrackRoom({
  locale,
  copy,
  build,
  state,
  seat,
  activeSeat,
  runtimeActions,
  trackLength,
  scoreLabel,
  race,
  sharedGoal,
  takeAway,
  rollAndMove,
  drawAndScore,
  pushYourLuck,
  turnTaking,
}: {
  locale: RoomLocale;
  copy: RoomCopy;
  build: PlayableBuild;
  state: SessionState;
  seat: number | null;
  activeSeat: number;
  runtimeActions: RuntimeAction[];
  trackLength: number;
  scoreLabel: string;
  race: Race | null;
  sharedGoal: SharedGoal | null;
  takeAway: TakeAway | null;
  rollAndMove: RollAndMove | null;
  drawAndScore: DrawAndScore | null;
  pushYourLuck: PushYourLuck | null;
  turnTaking: TurnTaking | null;
}) {
  const seatWord = locale === "zh" ? "座位" : "Seat";

  return (
    <>
      <div className="surface-action-grid">
        {runtimeActions.slice(0, 4).map((action, index) => {
          const detail = build.ruleSystem.actions.find((item) => item.id === action.id);
          return (
            <article className={`surface-action-card surface-action-card-${index + 1}`} key={action.id}>
              <span className="surface-action-symbol" aria-hidden="true">{CARD_SYMBOLS[index]}</span>
              <span className="surface-action-index">{roomActionTitle(locale, index)}</span>
              <strong>{action.label}</strong>
              <b>
                {rollAndMove
                  ? `${copy.roll} D${rollAndMove.dieSides}`
                  : drawAndScore
                    ? copy.draw
                    : pushYourLuck
                      ? action.label
                      : action.value === null
                        ? scoreLabel
                        : `${takeAway ? "−" : "+"}${action.value} ${scoreLabel}`}
              </b>
              <small>{displayActionDescription(detail?.description ?? action.label, locale)}</small>
            </article>
          );
        })}
      </div>

      <section aria-label={copy.playerArea} className="player-mat-grid">
        {sharedGoal ? (
          <article className="player-mat shared-goal-mat">
            <header>
              <span className="player-token" aria-hidden="true">✦</span>
              <div>
                <strong>{copy.progress}</strong>
                <small>{copy.goalReached}</small>
              </div>
              <b>
                {state.sharedGoal?.progress ?? 0}
                <small> / {sharedGoal.goalTarget}</small>
              </b>
            </header>
            <ScoreTrackBar
              ariaLabel={`${copy.progress}: ${state.sharedGoal?.progress ?? 0}`}
              filled={state.sharedGoal?.progress ?? 0}
              trackLength={trackLength}
            />
          </article>
        ) : takeAway ? (
          <article className="player-mat take-away-mat">
            <header>
              <span className="player-token" aria-hidden="true">●</span>
              <div>
                <strong>{copy.remaining}</strong>
                <small>
                  {state.status === "complete"
                    ? `${copy.winner} ${seatWord} ${state.winnerSeat}`
                    : `${copy.currentTurn}: ${seatWord} ${activeSeat}`}
                </small>
              </div>
              <b>
                {state.takeAway?.remaining ?? takeAway.initialPool}
                <small> / {takeAway.initialPool}</small>
              </b>
            </header>
            <ScoreTrackBar
              ariaLabel={`${copy.remaining}: ${state.takeAway?.remaining ?? takeAway.initialPool}`}
              filled={state.takeAway?.remaining ?? takeAway.initialPool}
              trackLength={trackLength}
            />
          </article>
        ) : rollAndMove ? (
          state.rollAndMove?.positions.map((position, seatIndex) => {
            const isYou = seat === seatIndex;
            const isActive = state.status === "active" && activeSeat === seatIndex;
            return (
              <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                <header>
                  <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                  <div>
                    <strong>{isYou ? copy.you : `${seatWord} ${seatIndex}`}</strong>
                    <small>{isActive ? copy.currentTurn : copy.position}</small>
                  </div>
                  <b>{position}<small> / {rollAndMove.targetPosition}</small></b>
                </header>
                <ScoreTrackBar
                  ariaLabel={`${copy.position}: ${position}`}
                  filled={position}
                  trackLength={trackLength}
                />
              </article>
            );
          }) ?? null
        ) : drawAndScore ? (
          <>
            <article className="player-mat shared-goal-mat">
              <header>
                <span className="player-token" aria-hidden="true">🎴</span>
                <div>
                  <strong>{copy.deckRemaining}</strong>
                  <small>{copy.lastDraw}: {state.drawAndScore?.lastDraw ?? "—"}</small>
                </div>
                <b>{state.drawAndScore?.remainingCards ?? 0}<small> / {state.drawAndScore?.totalCards ?? 0}</small></b>
              </header>
            </article>
            {state.scores.map((score, seatIndex) => {
              const isYou = seat === seatIndex;
              const isActive = state.status === "active" && activeSeat === seatIndex;
              return (
                <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                  <header>
                    <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                    <div>
                      <strong>{isYou ? copy.you : `${seatWord} ${seatIndex}`}</strong>
                      <small>{isActive ? copy.currentTurn : copy.points}</small>
                    </div>
                    <b>{score}<small> / {drawAndScore.victoryTarget}</small></b>
                  </header>
                  <ScoreTrackBar
                    ariaLabel={`${copy.points}: ${score}`}
                    filled={score}
                    trackLength={trackLength}
                  />
                </article>
              );
            })}
          </>
        ) : pushYourLuck ? (
          <>
            <article className="player-mat shared-goal-mat">
              <header>
                <span className="player-token" aria-hidden="true">🎲</span>
                <div>
                  <strong>{copy.unbanked}</strong>
                  <small>
                    {state.pushYourLuck?.lastRoll === pushYourLuck.bustFace
                      ? copy.bust
                      : `${copy.roll}: ${state.pushYourLuck?.lastRoll ?? "—"}`}
                  </small>
                </div>
                <b>{state.pushYourLuck?.turnScore ?? 0}</b>
              </header>
            </article>
            {state.scores.map((score, seatIndex) => {
              const isYou = seat === seatIndex;
              const isActive = state.status === "active" && activeSeat === seatIndex;
              return (
                <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                  <header>
                    <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                    <div>
                      <strong>{isYou ? copy.you : `${seatWord} ${seatIndex}`}</strong>
                      <small>{isActive ? copy.currentTurn : copy.points}</small>
                    </div>
                    <b>{score}<small> / {pushYourLuck.victoryTarget}</small></b>
                  </header>
                  <ScoreTrackBar
                    ariaLabel={`${copy.points}: ${score}`}
                    filled={score}
                    trackLength={trackLength}
                  />
                </article>
              );
            })}
          </>
        ) : turnTaking ? (
          <article className="player-mat turn-taking-mat">
            <header>
              <span className="player-token" aria-hidden="true">↻</span>
              <div>
                <strong>{copy.turn}</strong>
                <small>
                  {state.status === "complete"
                    ? copy.turnLimitReached
                    : seat === activeSeat && state.status === "active"
                      ? copy.yourTurn
                      : `${copy.currentTurn}: ${seatWord} ${activeSeat}`}
                </small>
              </div>
              <b>
                {state.turn}
                <small> / {turnTaking.maxTurns}</small>
              </b>
            </header>
            <ScoreTrackBar
              ariaLabel={`${copy.turn}: ${state.turn}`}
              filled={state.turn}
              trackLength={trackLength}
            />
          </article>
        ) : (
          state.scores.map((score, seatIndex) => {
            const isYou = seat === seatIndex;
            const isActive = state.status === "active" && activeSeat === seatIndex;
            return (
              <article className={`player-mat ${isActive ? "is-active" : ""} ${isYou ? "is-you" : ""}`} key={seatIndex}>
                <header>
                  <span className="player-token" aria-hidden="true">{seatIndex + 1}</span>
                  <div>
                    <strong>{isYou ? copy.you : `${seatWord} ${seatIndex}`}</strong>
                    <small>{isActive ? copy.currentTurn : copy.playerArea}</small>
                  </div>
                  <b>{score}<small> / {race?.victoryTarget ?? "—"}</small></b>
                </header>
                <ScoreTrackBar
                  ariaLabel={`${scoreLabel}: ${score}`}
                  filled={score}
                  trackLength={trackLength}
                />
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
