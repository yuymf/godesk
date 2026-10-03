import { useCallback, useEffect, useState } from "react";
import { Brand, GameMark } from "./CreatorBrand";
import { ExampleArtwork } from "./ExampleArtwork";
import { createSharedSession, getBuilds, getSharedSessions, listProjects } from "./project-api";
import type { GameProject, PlayableBuild, SharedSession } from "./project-contract";
import { conversationRelayKernel, hiddenRoleKernel, isAuctionBidding, isDiscFlipping, isHandPlay, isHarborVoyage, isHexSettlement, isNetworkRoute } from "./room-presentation";
import { othelloStartingBoardThumbnailDataUrl } from "./othello-thumbnail";
import { catanStartingBoardThumbnailDataUrl } from "./catan-thumbnail";
import { networkRouteStartingBoardThumbnailDataUrl } from "./network-route-thumbnail";
import { auctionBiddingThumbnailDataUrl } from "./auction-bidding-thumbnail";
import { handPlayStartingBoardThumbnailDataUrl } from "./hand-play-thumbnail";
import { buildCanOpenSharedSession, href, latestStudioPlayTarget } from "./studio-utils";

type LobbyGame = {
  project: GameProject;
  build?: PlayableBuild;
  session?: SharedSession;
};

export function GameLobby() {
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const projects = await listProjects();
      const loaded = await Promise.all(projects.map(async (project) => {
        const [builds, sessions] = await Promise.all([
          getBuilds(project.id),
          getSharedSessions(project.id),
        ]);
        return { project, ...latestStudioPlayTarget(builds, sessions) };
      }));
      setGames(loaded.sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt)));
      setStatus("ready");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法载入游戏列表。");
      setStatus("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function start(game: LobbyGame) {
    if (!game.build) return;
    setStartingId(game.project.id);
    setError("");
    try {
      const session = await createSharedSession(game.build.id, {
        seed: 42,
        idempotencyKey: crypto.randomUUID(),
      });
      window.location.assign(session.sessionUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "开局失败，请重试。");
      setStartingId(null);
    }
  }

  return (
    <main className="game-lobby shell-page" id="main">
      <header className="shell-header">
        <Brand />
        <nav aria-label="主导航">
          <a href={href("/")}>创建游戏</a>
          <a aria-current="page" href={href("/games")}>我的游戏</a>
          <a href={href("/settings")}>设置</a>
        </nav>
      </header>
      <div className="shell-content">
        <div className="shell-heading">
          <div><h1>我的游戏</h1><p>把想法做成游戏，再和朋友一起玩。</p></div>
          {games.length > 0 && <a className="shell-secondary" href={href("/")}>创建新游戏</a>}
        </div>
        {status === "loading" && <p aria-busy="true" role="status">正在载入游戏…</p>}
        {status === "error" && (
          <section className="shell-state" role="alert">
            <h2>游戏列表暂时打不开</h2><p>{error}</p>
            <button onClick={() => void load()} type="button">重试</button>
          </section>
        )}
        {status === "ready" && games.length === 0 && (
          <section className="shell-state">
            <h2>还没有游戏</h2>
            <p>写下想法或上传规则，生成后就能在这里继续。</p>
            <a className="shell-primary" href={href("/")}>创建第一款游戏</a>
          </section>
        )}
        {status === "ready" && games.length > 0 && (
          <section aria-label="游戏列表" className="lobby-grid">
            {games.map((game) => {
              const playable = Boolean(game.build && buildCanOpenSharedSession(game.build));
              const session = playable ? game.session : undefined;
              return (
                <article className="lobby-card" key={game.project.id}>
                  {game.build && isDiscFlipping(game.build.ruleSystem) ? (
                    <div
                      aria-hidden="true"
                      className="lobby-card-mark lobby-card-mark-othello"
                      data-lobby-mark="othello"
                    >
                      <img alt="" src={othelloStartingBoardThumbnailDataUrl()} />
                    </div>
                  ) : game.build && isHexSettlement(game.build.ruleSystem) ? (
                    <div
                      aria-hidden="true"
                      className="lobby-card-mark lobby-card-mark-catan"
                      data-lobby-mark="catan"
                    >
                      <img alt="" src={catanStartingBoardThumbnailDataUrl()} />
                    </div>
                  ) : game.build && isNetworkRoute(game.build.ruleSystem) ? (
                    <div
                      aria-hidden="true"
                      className="lobby-card-mark lobby-card-mark-network"
                      data-lobby-mark="network"
                    >
                      <img alt="" src={networkRouteStartingBoardThumbnailDataUrl()} />
                    </div>
                  ) : game.build && isAuctionBidding(game.build.ruleSystem) ? (
                    <div aria-hidden="true" className="lobby-card-mark" data-lobby-mark="auction">
                      <img alt="" src={auctionBiddingThumbnailDataUrl()} />
                    </div>
                  ) : game.build && isHandPlay(game.build.ruleSystem) ? (
                    <div
                      aria-hidden="true"
                      className="lobby-card-mark lobby-card-mark-card"
                      data-lobby-mark="card"
                    >
                      <img alt="" src={handPlayStartingBoardThumbnailDataUrl()} />
                    </div>
                  ) : game.build && isHarborVoyage(game.build.ruleSystem) ? (
                    <div aria-hidden="true" className="lobby-card-mark" data-lobby-mark="harbor">
                      <ExampleArtwork exampleId="harbor-13" />
                    </div>
                  ) : game.build && hiddenRoleKernel(game.build.ruleSystem) ? (
                    <div aria-hidden="true" className="lobby-card-mark" data-lobby-mark="hidden-role">
                      <ExampleArtwork exampleId="mistpeak-lodge" />
                    </div>
                  ) : game.build && conversationRelayKernel(game.build.ruleSystem) ? (
                    <div aria-hidden="true" className="lobby-card-mark" data-lobby-mark="conversation">
                      <ExampleArtwork exampleId="idea-relay" />
                    </div>
                  ) : (
                    <div aria-hidden="true" className="lobby-card-mark"><GameMark /></div>
                  )}
                  <div className="lobby-card-body">
                    <h2>{game.project.name}</h2>
                    <p>{session ? "这一局已开启，邀请朋友加入。" : playable ? "准备好开局，朋友可以从链接加入。" : "继续完成玩法后即可开局。"}</p>
                    <div className="lobby-card-actions">
                      {session ? (
                        <a className="shell-primary" href={session.sessionUrl}>继续这一局</a>
                      ) : playable ? (
                        <button className="shell-primary" disabled={startingId !== null} onClick={() => void start(game)} type="button">
                          {startingId === game.project.id ? "正在开局…" : "开始一局"}
                        </button>
                      ) : (
                        <a className="shell-primary" href={href(`/studio/${game.project.id}`)}>继续完成玩法</a>
                      )}
                      <a className="shell-secondary" href={href(`/studio/${game.project.id}`)}>管理游戏</a>
                      {session && <button className="shell-secondary lobby-share" type="button" onClick={() => {
                        void navigator.clipboard.writeText(new URL(session.sessionUrl, window.location.origin).href)
                          .then(() => setCopiedId(game.project.id))
                          .catch(() => setCopiedId(null));
                      }}>{copiedId === game.project.id ? "已复制邀请链接" : "复制邀请链接"}</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {error && status === "ready" && <p role="alert">{error}</p>}
      </div>
    </main>
  );
}
