import { useEffect, useState } from "react";
import {
  claimSessionSeat,
  getBuild,
  publicSharedSession,
  sharedSessionSocketUrl,
  submitSessionFeedback,
  submitSessionIntent,
} from "./project-api";
import type {
  PlayableBuild,
  SharedSession,
  SharedSessionSnapshot,
} from "./project-contract";
import {
  conversationRelayKernel,
  displayActionDescription,
  displayUnsupported,
  drawAndScoreKernel,
  handPlayKernel,
  hiddenRoleKernel,
  isHarborVoyage,
  localizedRoomError,
  pushYourLuckKernel,
  readRoomLocale,
  rollAndMoveKernel,
  ROOM_COPY,
  roomActionTitle,
  roomSurfaceCopy,
  scoreRaceKernel,
  sharedGoalKernel,
  takeAwayKernel,
  turnTakingKernel,
  usesScoreTrackSurface,
  type RoomLocale,
} from "./room-presentation";
import { ScoreTrackRoom } from "./ScoreTrackRoom";
import type { HarborVoyageState } from "../runtime/harbor-voyage";
import { HarborVoyageBoard } from "./HarborVoyageBoard";
import {
  readShareToken,
  readStoredSeatClaim,
  validationStudioHref,
  writeStoredSeatClaim,
} from "./studio-utils";

export function RoomView({ sessionId }: { sessionId: string }) {
  const [room, setRoom] = useState<SharedSession>();
  const [build, setBuild] = useState<PlayableBuild>();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [seat, setSeat] = useState<number | null>(
    () => readStoredSeatClaim(sessionId)?.seat ?? null,
  );
  const [locale, setLocale] = useState<RoomLocale>(readRoomLocale);
  const shareToken = readShareToken();
  const [seatToken, setSeatToken] = useState(
    () => readStoredSeatClaim(sessionId)?.seatToken,
  );
  const copy = ROOM_COPY[locale];

  useEffect(() => {
    window.localStorage.setItem("godesk-room-locale", locale);
  }, [locale]);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    const connectionError = locale === "zh"
      ? "实时连接中断，正在重连。"
      : "Live connection interrupted. Reconnecting.";

    const connect = () => {
      socket = new WebSocket(sharedSessionSocketUrl(sessionId, shareToken));
      socket.addEventListener("open", () => {
        setError((current) => current === connectionError ? "" : current);
        socket?.send(JSON.stringify({
          type: "session.sync",
          ...(seat !== null && seatToken ? { seat, seatToken } : {}),
        }));
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: unknown;
            session?: SharedSessionSnapshot;
          };
          if (
            message.type !== "session.snapshot" ||
            message.session?.id !== sessionId
          ) return;
          const nextRoom = publicSharedSession(
            message.session,
            window.location.origin,
            shareToken,
          );
          setRoom(nextRoom);
          setSeat((current) => {
            const stored = readStoredSeatClaim(sessionId);
            if (
              stored?.seatToken &&
              nextRoom.seats.some((entry) => entry.seat === stored.seat)
            ) {
              return stored.seat;
            }
            return current;
          });
        } catch {
          setError(locale === "zh" ? "实时状态格式无效。" : "Invalid live state.");
        }
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        setError(connectionError);
        reconnectTimer = window.setTimeout(connect, 1_000);
      });
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socket?.close(1000, "room_view_closed");
    };
  }, [locale, sessionId, shareToken, seat, seatToken]);

  useEffect(() => {
    if (!room?.buildId) return;
    getBuild(room.buildId, shareToken)
      .then(setBuild)
      .catch((reason: Error) => setError(reason.message));
  }, [room?.buildId, shareToken]);

  async function claimSeat(nextSeat: number) {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      const result = await claimSessionSeat(
        room.id,
        {
          seat: nextSeat,
          ...(seatToken ? { seatToken } : {}),
        },
        shareToken,
      );
      setRoom(result.session);
      setSeatToken(result.seatToken);
      const claimedSeat = result.session.seats.find((entry) => entry.seat === nextSeat)?.seat
        ?? nextSeat;
      setSeat(claimedSeat);
      writeStoredSeatClaim(room.id, {
        seat: claimedSeat,
        seatToken: result.seatToken,
      });
      setFeedback(`${copy.yourSeat}: ${locale === "zh" ? "座位" : "Seat"} ${claimedSeat}`);
    } catch (reason) {
      setError(localizedRoomError(reason, locale, "seat"));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(room?.sessionUrl ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setError(copy.copyFailed);
    }
  }

  async function act(
    actionId: string,
    actionIndex = -1,
    payload?: Record<string, unknown>,
  ) {
    if (!room || seat === null || !seatToken) {
      setError(copy.claimSeat);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const nextRoom = await submitSessionIntent(
        room.id,
        {
          intentId: crypto.randomUUID(),
          seat,
          seatToken,
          actionId,
          payload,
        },
        shareToken,
      );
      setRoom(nextRoom);
      if (actionIndex >= 0 && build) {
        const action = scoreRaceKernel(build.ruleSystem)?.actions[actionIndex] ??
          sharedGoalKernel(build.ruleSystem)?.actions[actionIndex] ??
          takeAwayKernel(build.ruleSystem)?.actions[actionIndex] ??
          rollAndMoveKernel(build.ruleSystem)?.actions[actionIndex] ??
          drawAndScoreKernel(build.ruleSystem)?.actions[actionIndex] ??
          pushYourLuckKernel(build.ruleSystem)?.actions[actionIndex] ??
          turnTakingKernel(build.ruleSystem)?.actions[actionIndex];
        const actionValue = action
          ? "points" in action
            ? action.points
            : "progress" in action
              ? action.progress
              : "take" in action
                ? action.take
                : null
          : null;
        const sharedGoal = sharedGoalKernel(build.ruleSystem);
        const takeAway = takeAwayKernel(build.ruleSystem);
        const rollAndMove = rollAndMoveKernel(build.ruleSystem);
        const drawAndScore = drawAndScoreKernel(build.ruleSystem);
        const pushYourLuck = pushYourLuckKernel(build.ruleSystem);
        const turnTaking = turnTakingKernel(build.ruleSystem);
        const scoreLabel = takeAway
          ? copy.take
          : rollAndMove
          ? copy.move
          : drawAndScore
          ? copy.draw
          : pushYourLuck
          ? copy.unbanked
          : turnTaking
          ? copy.turnAction
          : sharedGoal
            ? copy.progress
            : copy.points;
        const roll = nextRoom.state.rollAndMove?.lastRoll;
        const draw = nextRoom.state.drawAndScore?.lastDraw;
        const pushState = nextRoom.state.pushYourLuck;
        const pushAction = pushYourLuck?.actions[actionIndex];
        setFeedback(
          `${copy.actionSubmitted}: ${roomActionTitle(locale, actionIndex)}${rollAndMove && roll !== null && roll !== undefined ? ` · 🎲 ${roll} · +${roll} ${copy.move}` : drawAndScore && draw !== null && draw !== undefined ? ` · 🎴 ${draw} · +${draw} ${copy.points}` : pushYourLuck && pushAction?.id === "roll" && pushState ? ` · 🎲 ${pushState.lastRoll}${pushState.lastRoll === pushYourLuck.bustFace ? ` · ${copy.bust}` : ` · ${copy.unbanked} ${pushState.turnScore}`}` : pushYourLuck && pushAction?.id === "bank" ? ` · +${nextRoom.acceptedActions.at(-1)?.points ?? 0} ${copy.points}` : actionValue !== null ? ` · ${takeAway ? "−" : "+"}${actionValue} ${scoreLabel}` : ""}`,
        );
      }
    } catch (reason) {
      setError(localizedRoomError(reason, locale, "action"));
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback() {
    if (!room || seat === null || !seatToken || feedbackRating === 0 || feedbackComment.trim().length < 2) {
      setError(copy.feedbackRequired);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setRoom(await submitSessionFeedback(
        room.id,
        {
          seat,
          seatToken,
          rating: feedbackRating,
          comment: feedbackComment.trim(),
        },
        shareToken,
      ));
      setFeedback(copy.feedbackSubmitted);
      setFeedbackRating(0);
      setFeedbackComment("");
    } catch (reason) {
      setError(localizedRoomError(reason, locale, "feedback"));
    } finally {
      setBusy(false);
    }
  }

  if (error && !room) {
    return (
      <main className="studio-status" id="main">
        <h1>{locale === "zh" ? "这个 Shared Session 打不开。" : "This Shared Session cannot be opened."}</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!room || !build) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <h1>{locale === "zh" ? "正在重连 Shared Session…" : "Reconnecting to the Shared Session…"}</h1>
      </main>
    );
  }

  const race = scoreRaceKernel(build.ruleSystem);
  const sharedGoal = sharedGoalKernel(build.ruleSystem);
  const takeAway = takeAwayKernel(build.ruleSystem);
  const rollAndMove = rollAndMoveKernel(build.ruleSystem);
  const drawAndScore = drawAndScoreKernel(build.ruleSystem);
  const pushYourLuck = pushYourLuckKernel(build.ruleSystem);
  const turnTaking = turnTakingKernel(build.ruleSystem);
  const hiddenRole = hiddenRoleKernel(build.ruleSystem);
  const handPlay = handPlayKernel(build.ruleSystem);
  const conversationRelay = conversationRelayKernel(build.ruleSystem);
  const voyage = room.state.voyage;
  const harbor = isHarborVoyage(build.ruleSystem) && voyage;
  const gameName = build.ruleSystem.name;
  const activeSeat = room.state.activeSeat;
  const isMyTurn = room.state.status === "active" && seat === activeSeat;
  const latestOwnAction = seat === null
    ? undefined
    : [...room.acceptedActions].reverse().find((action) => action.seat === seat);
  const runtimeActions: Array<{ id: string; label: string; value: number | null }> = conversationRelay?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.points,
  })) ?? race?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.points,
  })) ?? sharedGoal?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.progress,
  })) ?? takeAway?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: action.take,
  })) ?? rollAndMove?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? drawAndScore?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? pushYourLuck?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? turnTaking?.actions.map((action) => ({
    id: action.id,
    label: action.label,
    value: null,
  })) ?? [];
  const runtimeTarget = race?.victoryTarget ?? sharedGoal?.goalTarget ?? takeAway?.initialPool ?? rollAndMove?.targetPosition ?? drawAndScore?.victoryTarget ?? pushYourLuck?.victoryTarget ?? turnTaking?.maxTurns ?? 12;
  const trackLength = Math.min(20, Math.max(8, runtimeTarget));
  const surface = roomSurfaceCopy(build.ruleSystem.playSurface.kind, locale);
  const isConversation = build.ruleSystem.playSurface.kind === "conversation";
  const scoreTrackSurface = usesScoreTrackSurface(build.ruleSystem);
  const scoreLabel = takeAway
    ? copy.take
    : rollAndMove
    ? copy.move
    : drawAndScore
    ? copy.draw
    : pushYourLuck
    ? copy.unbanked
    : turnTaking
    ? copy.turnAction
    : sharedGoal
      ? copy.progress
      : copy.points;

  return (
    <main className={`room-view ${harbor ? "room-view-voyage" : ""} ${hiddenRole ? "room-view-hidden-role" : ""} ${handPlay ? "room-view-hand-play" : ""} ${conversationRelay ? "room-view-conversation" : ""} ${sharedGoal ? "room-view-shared-goal" : ""} ${takeAway ? "room-view-take-away" : ""} ${rollAndMove ? "room-view-roll-and-move" : ""} ${drawAndScore ? "room-view-draw-and-score" : ""} ${pushYourLuck ? "room-view-push-your-luck" : ""} ${turnTaking ? "room-view-turn-taking" : ""}`} data-locale={locale} id="main">
      <header className="room-shell-header">
        <div className="room-title-block">
          <span className="room-brand-mark" aria-hidden="true">GD</span>
          <div>
            <span className="room-kicker">{copy.room}</span>
            <h1>{gameName}</h1>
          </div>
        </div>
        <div className="room-header-actions">
          <div aria-label={copy.language} className="room-locale-switch" role="group">
            <button
              aria-pressed={locale === "zh"}
              className={locale === "zh" ? "is-selected" : ""}
              onClick={() => setLocale("zh")}
              type="button"
            >
              中文
            </button>
            <button
              aria-pressed={locale === "en"}
              className={locale === "en" ? "is-selected" : ""}
              onClick={() => setLocale("en")}
              type="button"
            >
              EN
            </button>
          </div>
          <a
            href={validationStudioHref(room.projectId, {
              buildId: room.buildId,
              evidenceType: room.feedback.length
                ? "participant-feedback"
                : "human-session",
              evidenceId: room.id,
              hypothesisId: room.experiment?.hypothesisId,
            })}
          >
            {copy.studio}
          </a>
          <a href={room.replayUrl}>{copy.replay}</a>
        </div>
      </header>

      <section aria-label={copy.invitation} className="room-invitation room-invitation-rich">
        <div className="invitation-heading">
          <span className="room-kicker">{copy.invitation}</span>
          <strong>{copy.invitationHint}</strong>
        </div>
        <div className="invitation-link-row">
          <label>
            <span>{copy.inviteLink}</span>
            <input aria-label={copy.inviteLink} readOnly value={room.sessionUrl} />
          </label>
          <button onClick={() => void copyInvitation()} type="button">
            {copied ? copy.copiedInvite : copy.copyInvite}
          </button>
        </div>
        <label className="seat-picker">
          <span>{copy.yourSeat}</span>
          <select
            disabled={busy}
            onChange={(event) => {
              const selected = Number(event.target.value);
              if (Number.isInteger(selected)) void claimSeat(selected);
            }}
            value={seat ?? ""}
          >
            <option value="">{copy.chooseSeat}</option>
            {room.state.scores.map((_score, availableSeat) => {
              const occupant = room.seats.find((entry) => entry.seat === availableSeat);
              const isCurrentClient = seat === availableSeat;
              return (
                <option
                  disabled={Boolean(occupant && !isCurrentClient)}
                  key={availableSeat}
                  value={availableSeat}
                >
                  {locale === "zh" ? "座位" : "Seat"} {availableSeat}{occupant && !isCurrentClient ? ` · ${copy.occupied}` : ""}
                </option>
              );
            })}
          </select>
        </label>
      </section>

      {room.experiment && (
        <section
          aria-labelledby="experiment-brief-title"
          className="room-experiment-brief"
        >
          <span className="room-kicker">{copy.experimentTitle}</span>
          <h2 id="experiment-brief-title">{room.experiment.question}</h2>
          <p>
            <strong>{copy.experimentSignal}</strong>
            {room.experiment.successSignal}
          </p>
        </section>
      )}

      {harbor ? (
        <HarborVoyageBoard
          busy={busy}
          onAct={act}
          voyage={voyage as HarborVoyageState}
        />
      ) : (
        <section className="room-main">
          <section aria-live="polite" className="room-command-bar">
            <div>
              <span className="room-command-label">{copy.turn} {room.state.turn}</span>
              <strong>
                {room.state.status === "complete"
                  ? turnTaking
                    ? `${copy.gameOver} · ${copy.turnLimitReached}`
                    : sharedGoal
                      ? `${copy.gameOver} · ${copy.goalReached}`
                      : rollAndMove && room.state.winnerSeat === null
                        ? `${copy.gameOver} · ${copy.turnLimitReached}`
                      : drawAndScore && room.state.winnerSeat === null
                        ? `${copy.gameOver} · ${copy.deckExhausted} · ${copy.tiedGame}`
                      : pushYourLuck && room.state.winnerSeat === null
                        ? `${copy.gameOver} · ${copy.turnLimitReached}`
                      : `${copy.gameOver} · ${copy.winner} ${locale === "zh" ? "座位" : "Seat"} ${room.state.winnerSeat}`
                  : isMyTurn
                    ? copy.yourTurn
                    : `${copy.waitingFor} ${activeSeat}`}
              </strong>
              <p>{room.state.status === "complete" ? copy.gameOver : isMyTurn ? copy.actionHint : copy.waitForOther}</p>
            </div>
            <div className={`turn-callout ${isMyTurn ? "is-your-turn" : ""}`}>
              <span aria-hidden="true" />
              <b>{room.state.status === "complete" ? copy.gameOver : isMyTurn ? copy.currentTurn : copy.waitForOther}</b>
            </div>
          </section>

          <section
            aria-label={surface.label}
            className={`room-game-table ${isConversation ? "is-conversation" : ""}`}
          >
            <header className="table-section-header">
              <div>
                <span className="room-kicker">{surface.label}</span>
                <h2>{surface.title}</h2>
              </div>
              <span className="visual-floor-badge">✦ {surface.visual}</span>
            </header>

            {hiddenRole && room.state.hiddenRole && (
              <section className="hidden-role-board" aria-label="身份与发言">
                <p className="hidden-role-phase">
                  {room.state.hiddenRole.phase === "discuss"
                    ? "阶段：公开发言"
                    : room.state.hiddenRole.phase === "accuse"
                      ? "阶段：指控"
                      : "阶段：已揭晓"}
                </p>
                {seat !== null && (
                  <p className="hidden-role-self" data-testid="own-role">
                    你的身份：{room.state.hiddenRole.roles.find((role) => role.seat === seat)?.name ?? "未揭示"}
                  </p>
                )}
                <ol className="speech-transcript">
                  {room.state.hiddenRole.transcript.map((entry, index) => (
                    <li key={`${entry.seat}-${index}`}>
                      座位 {entry.seat}：{entry.text}
                    </li>
                  ))}
                </ol>
                {room.state.hiddenRole.accusations.length > 0 && (
                  <ul className="accusation-log">
                    {room.state.hiddenRole.accusations.map((entry) => (
                      <li key={`${entry.seat}-${entry.targetSeat}`}>
                        座位 {entry.seat} 指控座位 {entry.targetSeat}
                      </li>
                    ))}
                  </ul>
                )}
                {room.state.hiddenRole.phase === "resolved" && (
                  <p>
                    被揭晓的是座位 {room.state.hiddenRole.condemnedSeat}。
                    {room.state.hiddenRole.winnerAlignment === "town" ? "侦探与平民获胜。" : "凶手获胜。"}
                  </p>
                )}
              </section>
            )}
            {handPlay && room.state.handPlay && (
              <section className="hand-play-board" aria-label="手牌与出牌区">
                <p>牌库剩余 {room.state.handPlay.deckRemaining} 张</p>
                <div className="play-area">
                  {room.state.handPlay.playArea.map((card, index) => (
                    <span key={`${card.seat}-${index}`}>座位 {card.seat} 打出 {card.card}</span>
                  ))}
                </div>
                {seat !== null && (
                  <div className="own-hand" aria-label="你的手牌">
                    {(room.state.handPlay.hands[seat] ?? []).map((card, index) => (
                      <span key={`${card}-${index}`}>手牌 {card}</span>
                    ))}
                  </div>
                )}
              </section>
            )}
            {conversationRelay && room.state.conversation && (
              <section className="conversation-board" aria-label="发言记录">
                <ol className="speech-transcript">
                  {room.state.conversation.transcript.map((entry, index) => (
                    <li key={`${entry.seat}-${index}`}>
                      座位 {entry.seat} · {entry.text}
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {scoreTrackSurface && (
              <ScoreTrackRoom
                activeSeat={activeSeat}
                build={build}
                copy={copy}
                drawAndScore={drawAndScore}
                locale={locale}
                pushYourLuck={pushYourLuck}
                race={race}
                rollAndMove={rollAndMove}
                runtimeActions={runtimeActions}
                scoreLabel={scoreLabel}
                seat={seat}
                sharedGoal={sharedGoal}
                state={room.state}
                takeAway={takeAway}
                trackLength={trackLength}
                turnTaking={turnTaking}
              />
            )}

            <details className="source-zone-details">
              <summary>{copy.sourceText}</summary>
              <div>
                {build.ruleSystem.playSurface.regions.map((zone) => (
                  <span key={zone.id}>{zone.name}</span>
                ))}
              </div>
            </details>
          </section>

          <section aria-label={copy.actionPanel} className="room-action-panel">
            <header>
              <div>
                <span className="room-kicker">{copy.actionPanel}</span>
                <h2>{copy.actionTitle}</h2>
              </div>
              <p>{copy.actionHint}</p>
            </header>
            {seat === null && <div className="action-reminder">⌁ {copy.claimSeat}</div>}
            {seat !== null && !isMyTurn && room.state.status === "active" && (
              <div className="action-reminder is-muted">◷ {copy.waitForOther}</div>
            )}
            {feedback && <div aria-live="polite" className="action-feedback">✓ {feedback}</div>}
            {hiddenRole && room.state.hiddenRole ? (
              <div className="genre-action-form">
                {room.state.hiddenRole.phase === "discuss" ? (
                  <>
                    <label>
                      <span>这一轮你要说什么</span>
                      <textarea
                        aria-label="这一轮你要说什么"
                        onChange={(event) => setSpeechText(event.currentTarget.value)}
                        rows={3}
                        value={speechText}
                      />
                    </label>
                    <button
                      disabled={busy || !isMyTurn || speechText.trim().length < 2}
                      onClick={() => {
                        void act("speak", -1, { text: speechText.trim() }).then(() => setSpeechText(""));
                      }}
                      type="button"
                    >
                      发言
                    </button>
                  </>
                ) : room.state.hiddenRole.phase === "accuse" ? (
                  <div className="accusation-targets">
                    {room.state.scores.map((_score, target) => (
                      target === seat ? null : (
                        <button
                          disabled={busy || !isMyTurn}
                          key={target}
                          onClick={() => void act("accuse", -1, { targetSeat: target })}
                          type="button"
                        >
                          指控座位 {target}
                        </button>
                      )
                    ))}
                  </div>
                ) : (
                  <p>对局已揭晓。</p>
                )}
              </div>
            ) : handPlay && room.state.handPlay && seat !== null ? (
              <div className="hand-play-actions">
                {(room.state.handPlay.hands[seat] ?? []).map((card, index) => (
                  <button
                    disabled={busy || !isMyTurn}
                    key={`${card}-${index}`}
                    onClick={() => void act("play", -1, { cardIndex: index })}
                    type="button"
                  >
                    打出 {card}
                  </button>
                ))}
              </div>
            ) : conversationRelay ? (
              <div className="genre-action-form">
                <label>
                  <span>写下你的发言</span>
                  <textarea
                    aria-label="写下你的发言"
                    onChange={(event) => setSpeechText(event.currentTarget.value)}
                    rows={3}
                    value={speechText}
                  />
                </label>
                <div className="room-action-cards">
                  {runtimeActions.map((action, index) => (
                    <button
                      aria-label={action.label}
                      disabled={busy || !isMyTurn || speechText.trim().length < 2}
                      key={action.id}
                      onClick={() => {
                        void act(action.id, index, { text: speechText.trim() }).then(() => setSpeechText(""));
                      }}
                      type="button"
                    >
                      <b>{roomActionTitle(locale, index)}</b>
                      <strong>{action.label}</strong>
                    </button>
                  ))}
                </div>
              </div>
            ) : runtimeActions.length > 0 ? (
              <div className="room-action-cards">
                {runtimeActions.map((action, index) => {
                  const detail = build.ruleSystem.actions.find((item) => item.id === action.id);
                  const enabled = !busy && isMyTurn && (
                    (!takeAway || action.value === null || action.value <= (room.state.takeAway?.remaining ?? 0)) &&
                    (!pushYourLuck || action.id !== "bank" || (room.state.pushYourLuck?.turnScore ?? 0) > 0)
                  );
                  return (
                    <button
                      aria-label={`${roomActionTitle(locale, index)} ${rollAndMove ? `${copy.roll} D${rollAndMove.dieSides}` : drawAndScore ? copy.draw : pushYourLuck ? action.label : action.value === null ? scoreLabel : `${takeAway ? "−" : "+"}${action.value} ${scoreLabel}`}`}
                      className={enabled ? "is-available" : ""}
                      disabled={!enabled}
                      key={action.id}
                      onClick={() => void act(action.id, index)}
                      type="button"
                    >
                      <span className="action-card-index">{String(index + 1).padStart(2, "0")}</span>
                      <b>{roomActionTitle(locale, index)}</b>
                      <strong>
                        {rollAndMove ? `${copy.roll} D${rollAndMove.dieSides}` : drawAndScore ? copy.draw : pushYourLuck ? action.label : action.value === null ? scoreLabel : <>{`${takeAway ? "−" : "+"}${action.value}`} <small>{scoreLabel}</small></>}
                      </strong>
                      <span>{displayActionDescription(detail?.description ?? action.label, locale)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="action-reminder is-muted">{copy.noActions}</div>
            )}
            {error && <p className="creator-error" role="alert">{error}</p>}
          </section>
        </section>
      )}

      <section aria-label={copy.feedbackTitle} className="room-feedback-panel">
        <header>
          <div>
            <span className="room-kicker">{copy.feedbackTitle}</span>
            <h2>{copy.feedbackTitle}</h2>
          </div>
          <p>{room.experiment ? copy.experimentFeedbackHint : copy.feedbackHint}</p>
        </header>
        {seat === null ? (
          <div className="action-reminder">⌁ {copy.claimSeat}</div>
        ) : !latestOwnAction ? (
          <div className="action-reminder">⌁ {copy.feedbackActionRequired}</div>
        ) : (
          <form
            className="room-feedback-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submitFeedback();
            }}
          >
            <fieldset>
              <legend>{copy.feedbackRating}</legend>
              <div aria-label={copy.feedbackRating} className="feedback-rating" role="group">
                {([1, 2, 3, 4, 5] as const).map((rating) => (
                  <button
                    aria-pressed={feedbackRating === rating}
                    className={feedbackRating >= rating ? "is-selected" : ""}
                    disabled={busy}
                    key={rating}
                    onClick={() => setFeedbackRating(rating)}
                    type="button"
                  >
                    <span aria-hidden="true">★</span>
                    <span className="sr-only">{rating} / 5</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              <span>{room.experiment ? copy.experimentFeedbackComment : copy.feedbackComment}</span>
              <textarea
                maxLength={1000}
                onChange={(event) => setFeedbackComment(event.currentTarget.value)}
                placeholder={copy.feedbackPlaceholder}
                rows={3}
                value={feedbackComment}
              />
            </label>
            <button
              className="feedback-submit"
              disabled={busy || feedbackRating === 0 || feedbackComment.trim().length < 2}
              type="submit"
            >
              {copy.feedbackSubmit}
            </button>
            {room.feedback.filter((entry) => entry.seat === seat).map((entry) => (
              <p className="feedback-saved" key={entry.id}>
                {copy.feedbackSubmitted} · {locale === "zh" ? "行动" : "Action"} #{entry.moment.actionSequence} · {build.ruleSystem.actions
                  .find((action) => action.id === entry.moment.actionId)?.label ?? entry.moment.actionId} · {"★".repeat(entry.rating)} · {entry.comment}
              </p>
            ))}
          </form>
        )}
      </section>

      {error && harbor && <p className="creator-error" role="alert">{error}</p>}

      <aside className="action-log">
        <span>{copy.log}</span>
        <code>{room.id}</code>
        {room.acceptedActions.length ? (
          <ol>
            {room.acceptedActions.map((action) => (
              <li key={action.sequence}>
                #{action.sequence} · {locale === "zh" ? "座位" : "Seat"} {action.seat} · {(() => {
                  const actionIndex = runtimeActions.findIndex((candidate) => candidate.id === action.actionId);
                  return actionIndex >= 0 ? roomActionTitle(locale, actionIndex) : action.actionId;
                })()}
                {typeof action.payload?.text === "string" ? ` · ${action.payload.text}` : ""}
                {action.state.pushYourLuck ? action.actionId === "roll" ? ` · 🎲 ${action.points}${action.points === action.state.pushYourLuck.bustFace ? ` · ${copy.bust}` : ` · ${copy.unbanked} ${action.state.pushYourLuck.turnScore}`}` : ` · +${action.points} ${copy.points}` : action.points ? action.state.rollAndMove ? ` · 🎲 ${action.points} · +${action.points} ${copy.move}` : action.state.drawAndScore ? ` · 🎴 ${action.points} · +${action.points} ${copy.points}` : ` · ${action.state.takeAway ? "−" : "+"}${action.points} ${scoreLabel}` : ""}
              </li>
            ))}
          </ol>
        ) : (
          <p>{copy.noLog}</p>
        )}
        {build.ruleSystem.runtimeSupport.status === "executable" &&
          build.ruleSystem.runtimeSupport.unsupported.length > 0 && (
            <div className="room-unsupported">
              <strong>{copy.unsupported}</strong>
              <ul>
                {build.ruleSystem.runtimeSupport.unsupported.map((item) => (
                  <li key={item}>{displayUnsupported(item, locale)}</li>
                ))}
              </ul>
            </div>
          )}
      </aside>
    </main>
  );
}
