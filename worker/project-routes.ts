import { mountHref } from "../src/public-mount";
import type {
  CreateProjectResult,
  CreatorJob,
  GameProject,
} from "../src/creator/project-contract";
import { shareSecret, shareTokenFromUrl } from "./share-capability";
import {
  PROJECT_PREFIX,
  json,
  error,
  publicBuild,
  publicPlaytest,
  publicSession,
  publicMutation,
  publicJob,
  publicizeProjectViewData,
  type StoredPlayableBuild,
  type StoredPlaytest,
  type StoredSharedSession,
  type StoredApplyProjectChangesResult,
  type StoredCompileBuildResult,
  type StoredDuplicateRuleSystemResult,
  type StoredRestoreBuildResult,
} from "./project-operations";

type Publicize =
  | "none"
  | "create-project"
  | "create-project-duplicate"
  | "mutation"
  | "mutation-build"
  | "job"
  | "build"
  | "playtest"
  | "session"
  | "seat"
  | "project-view";

type ApiRoute = {
  method: string;
  match: (url: URL) => RegExpMatchArray | [] | null;
  internal: (url: URL, match: RegExpMatchArray | []) => string | URL;
  publicize: Publicize;
  injectAuth?: boolean;
  forwardShare?: boolean;
  websocket?: boolean;
};

const exact = (method: string, pathname: string, internal: string, publicize: Publicize, extra?: Partial<ApiRoute>): ApiRoute => ({
  method,
  match: (url) => url.pathname === pathname ? [] : null,
  internal: () => internal,
  publicize,
  ...extra,
});

const pattern = (
  method: string,
  regex: RegExp,
  internal: (match: RegExpMatchArray) => string,
  publicize: Publicize,
  extra?: Partial<ApiRoute>,
): ApiRoute => ({
  method,
  match: (url) => url.pathname.match(regex),
  internal: (_url, match) => internal(match as RegExpMatchArray),
  publicize,
  ...extra,
});

const PROJECT_API_ROUTES: ApiRoute[] = [
  exact("POST", "/api/projects", "/projects", "create-project", { injectAuth: true }),
  exact("GET", "/api/projects", "/projects", "none"),
  pattern("POST", /^\/api\/projects\/([^/]+)\/duplicate$/, (m) => `${PROJECT_PREFIX}${m[1]}/duplicate`, "create-project-duplicate"),
  pattern("POST", /^\/api\/projects\/([^/]+)\/rule-systems\/([^/]+)\/duplicate$/, (m) => `/projects/${m[1]}/rule-systems/${m[2]}/duplicate`, "mutation"),
  pattern("POST", /^\/api\/projects\/([^/]+)\/builds\/([^/]+)\/restore$/, (m) => `/projects/${m[1]}/builds/${m[2]}/restore`, "mutation"),
  pattern("DELETE", /^\/api\/projects\/([^/]+)$/, (m) => `${PROJECT_PREFIX}${m[1]}`, "none"),
  {
    method: "GET",
    match: (url) => url.pathname.startsWith("/api/projects/") ? [] : null,
    internal: (url) => {
      const internalUrl = new URL(
        `https://projects.internal${PROJECT_PREFIX}${url.pathname.slice("/api/projects/".length)}`,
      );
      internalUrl.search = url.search;
      return internalUrl;
    },
    publicize: "project-view",
  },
  pattern("POST", /^\/api\/projects\/([^/]+)\/changes$/, (m) => `${PROJECT_PREFIX}${m[1]}/changes`, "mutation"),
  pattern("POST", /^\/api\/projects\/([^/]+)\/jobs$/, (m) => `/projects/${m[1]}/jobs`, "job"),
  pattern("GET", /^\/api\/jobs\/([^/]+)\/artifact$/, (m) => `/jobs/${m[1]}/artifact`, "none"),
  pattern("GET", /^\/api\/jobs\/([^/]+)$/, (m) => `/jobs/${m[1]}`, "job"),
  pattern("POST", /^\/api\/jobs\/([^/]+)\/retry$/, (m) => `/jobs/${m[1]}/retry`, "job"),
  pattern("POST", /^\/api\/projects\/([^/]+)\/builds$/, (m) => `${PROJECT_PREFIX}${m[1]}/builds`, "mutation-build"),
  pattern("GET", /^\/api\/builds\/([^/]+)$/, (m) => `/builds/${m[1]}`, "build"),
  pattern("POST", /^\/api\/builds\/([^/]+)\/playtests$/, (m) => `/builds/${m[1]}/playtests`, "playtest"),
  pattern("POST", /^\/api\/builds\/([^/]+)\/sessions$/, (m) => `/builds/${m[1]}/sessions`, "session"),
  pattern("GET", /^\/api\/sessions\/([^/]+)\/events$/, (m) => `/sessions/${m[1]}/events`, "none", { websocket: true }),
  pattern("POST", /^\/api\/sessions\/([^/]+)\/seats$/, (m) => `/sessions/${m[1]}/seats`, "seat", { forwardShare: true }),
  pattern("POST", /^\/api\/sessions\/([^/]+)\/intents$/, (m) => `/sessions/${m[1]}/intents`, "session", { forwardShare: true }),
  pattern("POST", /^\/api\/sessions\/([^/]+)\/feedback$/, (m) => `/sessions/${m[1]}/feedback`, "session", { forwardShare: true }),
  pattern("GET", /^\/api\/playtests\/([^/]+)$/, (m) => `/playtests/${m[1]}`, "playtest"),
  pattern("GET", /^\/api\/sessions\/([^/]+)$/, (m) => `/sessions/${m[1]}`, "session"),
  pattern("GET", /^\/api\/replays\/([^/]+)$/, (m) => `/replays/${m[1]}`, "none"),
];

async function publicizeProjectView(
  response: Response,
  url: URL,
  creatorId: string,
  secret: string,
  mount: string,
) {
  const view = url.searchParams.get("view");
  if (
    view !== "builds" &&
    view !== "playtests" &&
    view !== "sessions" &&
    view !== "playtest-link" &&
    view !== "jobs" &&
    view !== "activity"
  ) {
    return response;
  }
  const body = await response.json<Record<string, unknown>>();
  return json(
    await publicizeProjectViewData(view, body, {
      origin: url.origin,
      creatorId,
      secret,
      mount,
    }),
  );
}

export async function projectApi(
  request: Request,
  env: Env,
  creatorId: string,
  authentication: "local-development-only" | "oauth",
) {
  const url = new URL(request.url);
  const mount = request.headers.get("x-godesk-mount") ?? url.pathname;
  const stub = env.CREATOR_PROJECTS.getByName(creatorId);
  const secret = shareSecret(env, url.hostname);
  const shareToken = shareTokenFromUrl(url);
  const route = PROJECT_API_ROUTES.find((candidate) =>
    candidate.method === request.method && candidate.match(url),
  );
  if (!route) return error("没有这个 API。", 404);
  const matched = route.match(url);
  if (matched === null) return error("没有这个 API。", 404);

  if (route.websocket && request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return error("Shared Session 实时连接需要 WebSocket upgrade。", 426);
  }

  const target = route.internal(url, matched);
  const targetUrl = typeof target === "string"
    ? `https://projects.internal${target}`
    : target.toString();

  let outbound: Request | string;
  let createdTemplateId: unknown;
  if (route.injectAuth) {
    const input = await request
      .json<{ name?: unknown; templateId?: unknown }>()
      .catch(() => ({
        name: undefined,
        templateId: undefined,
      }));
    createdTemplateId = input.templateId;
    outbound = new Request(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        templateId: input.templateId,
        authentication,
      }),
    });
  } else if (route.forwardShare && shareToken) {
    outbound = publicShareForwardRequest(targetUrl, request);
  } else if (route.publicize === "none" && request.method === "GET" && !route.websocket) {
    outbound = targetUrl;
  } else {
    outbound = new Request(targetUrl, request);
  }

  const response = await stub.fetch(outbound);
  if (route.publicize === "none" || !response.ok) return response;

  if (route.publicize === "create-project") {
    const project = await response.json<GameProject>();
    const result: CreateProjectResult = {
      project,
      studioUrl: new URL(mountHref(`/studio/${project.id}`, mount), url.origin).toString(),
      warnings: createdTemplateId
        ? []
        : ["新项目尚未包含来源、结构化规则或 Game Entity。"],
    };
    return json(result, 201);
  }
  if (route.publicize === "create-project-duplicate") {
    const project = await response.json<GameProject>();
    return json(
      {
        project,
        studioUrl: new URL(mountHref(`/studio/${project.id}`, mount), url.origin).toString(),
        warnings: [],
      } satisfies CreateProjectResult,
      response.status,
    );
  }
  if (route.publicize === "mutation") {
    return json(
      publicMutation(
        await response.json<
          | StoredApplyProjectChangesResult
          | StoredDuplicateRuleSystemResult
          | StoredRestoreBuildResult
        >(),
        url.origin,
        mount,
      ),
      response.status,
    );
  }
  if (route.publicize === "mutation-build") {
    const result = await response.json<StoredCompileBuildResult>();
    return json(
      publicMutation({
        ...result,
        build: await publicBuild(result.build, url.origin, creatorId, secret, mount),
      }, url.origin, mount),
      response.status,
    );
  }
  if (route.publicize === "job") {
    return json(
      await publicJob(await response.json<CreatorJob>(), url.origin, creatorId, secret, mount),
      response.status,
    );
  }
  if (route.publicize === "build") {
    return json(await publicBuild(await response.json<StoredPlayableBuild>(), url.origin, creatorId, secret, mount));
  }
  if (route.publicize === "playtest") {
    return json(
      await publicPlaytest(await response.json<StoredPlaytest>(), url.origin, creatorId, secret, mount),
      response.status,
    );
  }
  if (route.publicize === "session") {
    return json(
      await publicSession(await response.json<StoredSharedSession>(), url.origin, creatorId, secret, mount),
      response.status,
    );
  }
  if (route.publicize === "seat") {
    const claimed = await response.json<{
      session: StoredSharedSession;
      seatToken: string;
    }>();
    return json(
      {
        session: await publicSession(claimed.session, url.origin, creatorId, secret, mount),
        seatToken: claimed.seatToken,
      },
      response.status,
    );
  }
  return publicizeProjectView(response, url, creatorId, secret, mount);
}

export function publicShareForwardRequest(target: string, request: Request) {
  const forwarded = new Request(target, request);
  forwarded.headers.set("x-godesk-public-share", "1");
  return forwarded;
}

export function isPublicSharePage(url: URL) {
  return /^\/(?:play|room|replay|try)\/[^/]+$/.test(url.pathname);
}

export function isPublicShareApi(request: Request) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    return /^\/api\/(?:builds|sessions|replays)\/[^/]+$/.test(url.pathname) ||
      /^\/api\/sessions\/[^/]+\/events$/.test(url.pathname);
  }
  return /^\/api\/sessions\/[^/]+\/(?:seats|intents|feedback)$/.test(url.pathname) &&
    request.method === "POST";
}
