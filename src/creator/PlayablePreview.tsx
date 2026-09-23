import { useEffect, useState } from "react";
import { getBuild } from "./project-api";
import type { PlayableBuild } from "./project-contract";
import { createHarborVoyageState } from "../runtime/harbor-voyage";
import { createWorkerPlacementState } from "../runtime/worker-placement";
import {
  drawAndScoreKernel,
  isHarborVoyage,
  workerPlacementKernel,
  pushYourLuckKernel,
  rollAndMoveKernel,
  scoreRaceKernel,
  sharedGoalKernel,
  takeAwayKernel,
  turnTakingKernel,
  usesScoreTrackSurface,
} from "./room-presentation";
import { HarborVoyageBoard } from "./HarborVoyageBoard";
import { WorkerPlacementBoard } from "./WorkerPlacementBoard";
import { href, readShareToken } from "./studio-utils";

export function PlayablePreview({ buildId }: { buildId: string }) {
  const [build, setBuild] = useState<PlayableBuild>();
  const [error, setError] = useState("");
  const shareToken = readShareToken();

  useEffect(() => {
    getBuild(buildId, shareToken).then(setBuild).catch((reason: Error) => {
      setError(reason.message);
    });
  }, [buildId, shareToken]);

  if (error) {
    return (
      <main className="studio-status" id="main">
        <h1>这个版本打不开。</h1>
        <p role="alert">{error}</p>
      </main>
    );
  }
  if (!build) {
    return (
      <main className="studio-status" id="main" aria-busy="true">
        <h1>正在打开这个版本…</h1>
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
  const harbor = isHarborVoyage(build.ruleSystem);
  const workerPlacement = workerPlacementKernel(build.ruleSystem);
  const scoreTrackSurface = usesScoreTrackSurface(build.ruleSystem);
  const runtimeValues = new Map(
    race?.actions.map((action) => [action.id, action.points]) ??
      sharedGoal?.actions.map((action) => [action.id, action.progress]) ??
      takeAway?.actions.map((action) => [action.id, action.take]) ??
      [],
  );
  const runtimeTarget = race?.victoryTarget ?? sharedGoal?.goalTarget ?? takeAway?.initialPool ?? rollAndMove?.targetPosition ?? drawAndScore?.victoryTarget ?? pushYourLuck?.victoryTarget;

  return (
    <main className="playable-preview" id="main">
      <header>
        <span>这个版本长什么样</span>
        <a href={href(`/studio/${build.projectId}`)}>回工作室</a>
      </header>
      <section className="preview-hero">
        <div className="preview-title">
          <span>第 {build.ruleSystemVersion} 版</span>
          <h1>{build.ruleSystem.name}</h1>
          <p>{build.ruleSystem.pitch || "这个版本还没有一句话玩法。"}</p>
        </div>
        <dl>
          <div>
            <dt>人数</dt>
            <dd>
              {build.ruleSystem.participants.min ===
              build.ruleSystem.participants.max
                ? build.ruleSystem.participants.default
                : `${build.ruleSystem.participants.min}–${build.ruleSystem.participants.max}`}
            </dd>
          </div>
          <div>
            <dt>时长</dt>
            <dd>{build.ruleSystem.durationMinutes} 分钟</dd>
          </div>
          <div>
            <dt>玩法</dt>
            <dd>
              {build.ruleSystem.runtimeSupport.status === "executable"
                ? build.ruleSystem.runtimeSupport.kernel.type
                : "draft"}
            </dd>
          </div>
        </dl>
      </section>
      {harbor ? (
        <section className="preview-board" aria-label="航次可玩桌面">
          <HarborVoyageBoard
            readOnly
            voyage={createHarborVoyageState(
              build.ruleSystem.participants.default,
            )}
          />
        </section>
      ) : workerPlacement ? (
        <section className="preview-board" aria-label="工人放置可玩桌面">
          <WorkerPlacementBoard
            readOnly
            board={createWorkerPlacementState({
              playerCount: workerPlacement.playerCount,
              workersPerSeat: workerPlacement.workersPerSeat,
              startingCoins: workerPlacement.startingCoins,
              regions: workerPlacement.regions,
              victoryTarget: workerPlacement.victoryTarget,
              victoryBuildings: workerPlacement.victoryBuildings,
            })}
          />
        </section>
      ) : (
        <>
          <section className="preview-board" aria-label="结构化可玩桌面">
            <div className="preview-section-heading">
              <span>可玩桌面</span>
              <strong>{build.ruleSystem.playSurface.layout || "未配置桌面布局"}</strong>
            </div>
            {build.ruleSystem.presentation.image && (
              <img
                alt={build.ruleSystem.presentation.image.alt}
                className="preview-rulebook-art"
                src={build.ruleSystem.presentation.image.url}
              />
            )}
            <div className="preview-board-canvas">
              {build.ruleSystem.playSurface.regions.length > 0 ? (
                build.ruleSystem.playSurface.regions.map((zone) => (
                  <article className="preview-zone" key={zone.id}>
                    {zone.image && <img alt={zone.image.alt} src={zone.image.url} />}
                    <span>区域</span>
                    <h2>{zone.name}</h2>
                    <p>{zone.description}</p>
                  </article>
                ))
              ) : (
                <p className="preview-empty">这个 Rule System 还没有可展示的游戏区域。</p>
              )}
              {scoreTrackSurface && (
              <div
                className="preview-score-track"
                aria-label={takeAway ? "共享拿取池" : rollAndMove ? "位置轨道" : drawAndScore ? "抽牌牌库与分数" : pushYourLuck ? "未存分与总分" : turnTaking ? "回合轨道" : sharedGoal ? "共享目标进度" : "分数轨道"}
              >
                <span>{takeAway ? "共享物件" : rollAndMove ? "前进轨道" : drawAndScore ? "抽牌牌库" : pushYourLuck ? "冒险与存分" : turnTaking ? "回合顺序" : sharedGoal ? "共同目标" : "分数轨道"}</span>
                <div>
                  <b>{takeAway?.initialPool ?? (drawAndScore ? drawAndScore.cardValues.length * drawAndScore.copiesPerValue : 0)}</b>
                  <i aria-hidden="true" />
                  <b>{takeAway ? 0 : turnTaking?.maxTurns ?? runtimeTarget ?? "—"}</b>
                </div>
                <small>
                  {race
                    ? `先达到 ${race.victoryTarget} 分 · 最多 ${race.maxTurns} 回合`
                    : sharedGoal
                      ? `共同达到 ${sharedGoal.goalTarget} 点 · 最多 ${sharedGoal.maxTurns} 回合`
                      : takeAway
                        ? `从 ${takeAway.initialPool} 个物件开始 · 拿走最后一个者获胜`
                      : rollAndMove
                        ? `D${rollAndMove.dieSides} · 先到 ${rollAndMove.targetPosition} 格 · 安全上限 ${rollAndMove.maxTurns} 回合`
                      : drawAndScore
                        ? `${drawAndScore.cardValues.join("/")} 各 ${drawAndScore.copiesPerValue} 张 · 先到 ${drawAndScore.victoryTarget} 分`
                      : pushYourLuck
                        ? `D${pushYourLuck.dieSides} · ${pushYourLuck.bustFace} 爆掉 · 收手存分 · 先到 ${pushYourLuck.victoryTarget} 分`
                      : turnTaking
                        ? `最多 ${turnTaking.maxTurns} 回合；不自动判定胜负`
                    : "尚未配置确定性运行时"}
                </small>
              </div>
              )}
            </div>
          </section>
          <section className="preview-actions" aria-label="可用行动预览">
            <div className="preview-section-heading">
              <span>可用行动</span>
              <strong>{build.ruleSystem.actions.length} 个行动</strong>
            </div>
            <div className="preview-action-grid">
              {build.ruleSystem.actions.length > 0 ? (
                build.ruleSystem.actions.map((action) => (
                  <article key={action.id}>
                    <span>{action.id}</span>
                    <h2>{action.label}</h2>
                    <p>{action.description}</p>
                    <strong>
                      {runtimeValues.has(action.id)
                        ? `${takeAway ? "−" : "+"}${runtimeValues.get(action.id)} ${takeAway ? "个物件" : sharedGoal ? "进度" : "分"}`
                        : rollAndMove
                          ? `掷 D${rollAndMove.dieSides}`
                        : drawAndScore
                          ? "从牌库顶抽牌计分"
                        : pushYourLuck
                          ? action.label
                        : turnTaking
                          ? "轮流行动"
                        : "未映射到运行时"}
                    </strong>
                  </article>
                ))
              ) : (
                <p className="preview-empty">这个 Rule System 还没有可用行动。</p>
              )}
            </div>
          </section>
        </>
      )}
      <aside>
        <h2>这个版本的依据</h2>
        <code>{build.id}</code>
        {build.warnings.length > 0 && (
          <>
            <h3>要注意</h3>
            <ul>
              {build.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </>
        )}
        {build.unsupportedBehavior.length > 0 && (
          <>
            <h3>这一版还做不到</h3>
            <ul>
              {build.unsupportedBehavior.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </>
        )}
        <p>
          这是按当前版本生成的可玩桌面，不是截图，也不等于已经真人试过。
        </p>
      </aside>
    </main>
  );
}
