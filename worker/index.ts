export { CreatorProjects } from "./creator-projects-do";
import {
  anonymousCreator,
  authorizeRequest,
  finishWebLogin,
  protectedResourceMetadata,
  requiredScopes,
  startWebLogin,
  withCookies,
} from "./auth";
import { logicalPathname } from "../src/public-mount";
import { godeskMcpHandler } from "./mcp";
import {
  capabilityMatches,
  publicShareUrl,
  resourceKindFromPath,
  shareSecret,
  shareTokenFromUrl,
  verifyShareToken,
} from "./share-capability";
import { projectApi, isPublicShareApi, isPublicSharePage } from "./project-routes";
import { error, type StoredPlaytestLink } from "./project-operations";

const READ_ONLY_MCP_TOOLS = new Set([
  "list_projects",
  "read_project",
  "get_studio_url",
  "track_job",
  "read_build",
  "read_shared_session",
  "read_replay",
]);

async function mcpScopes(request: Request) {
  if (request.method !== "POST") return ["godesk:read"];
  const payload = await request.clone().json<
    | { method?: string; params?: { name?: string } }
    | Array<{ method?: string; params?: { name?: string } }>
  >().catch(() => undefined);
  const messages = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const mutates = messages.some(
    (message) =>
      message.method === "tools/call" &&
      !READ_ONLY_MCP_TOOLS.has(String(message.params?.name)),
  );
  return mutates ? ["godesk:read", "godesk:write"] : ["godesk:read"];
}

export default {
  async fetch(request, env, ctx) {
    const incoming = new URL(request.url);
    const mount = incoming.pathname;
    const logical = logicalPathname(incoming.pathname);
    const url = new URL(incoming);
    if (logical !== "/chatgpt-plugin") url.pathname = logical;
    const routed = new Request(url, request);
    routed.headers.set("x-godesk-mount", mount);
    const shareToken = shareTokenFromUrl(url);
    const shareCapability = shareToken
      ? await verifyShareToken(shareToken, shareSecret(env, url.hostname))
      : null;
    const shareResource = resourceKindFromPath(url.pathname);
    const validShare = Boolean(
      shareCapability &&
      shareResource &&
      capabilityMatches(shareCapability, shareResource.kind, shareResource.resourceId),
    );
    const playtestLinkMatch = url.pathname.match(/^\/try\/([^/]+)$/);
    if (routed.method === "GET" && validShare && shareCapability && playtestLinkMatch) {
      const stub = env.CREATOR_PROJECTS.getByName(shareCapability.c);
      const response = await stub.fetch(
        `https://projects.internal/projects/${playtestLinkMatch[1]}?view=playtest-link`,
      );
      if (!response.ok) return response;
      const { playtestLink } = await response.json<{
        playtestLink: StoredPlaytestLink | null;
      }>();
      if (!playtestLink) return error("playtest_link_not_published", 404);
      return Response.redirect(
        publicShareUrl(`/room/${playtestLink.sessionId}`, url.origin, shareToken!, mount),
        302,
      );
    }
    if (
      validShare &&
      shareCapability &&
      (isPublicSharePage(url) || isPublicShareApi(routed))
    ) {
      if (isPublicShareApi(routed)) {
        return projectApi(routed, env, shareCapability.c, "oauth");
      }
      return env.ASSETS.fetch(request);
    }
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp" ||
      url.pathname === "/.well-known/oauth-protected-resource/chatgpt-plugin/mcp"
    ) {
      return protectedResourceMetadata(request, env);
    }
    if (url.pathname === "/login") {
      return startWebLogin(routed, env);
    }
    if (url.pathname === "/oauth/callback") {
      return finishWebLogin(routed, env);
    }
    if (url.pathname === "/mcp") {
      const identity = await authorizeRequest(
        routed,
        env,
        await mcpScopes(routed),
      );
      if (identity instanceof Response) return identity;
      return godeskMcpHandler(
        routed,
        env,
        identity.creatorId,
        identity.mode === "oauth" ? "oauth" : "local-development-only",
      )(
        routed,
        env,
        ctx,
      );
    }
    if (url.pathname.startsWith("/api/")) {
      const identity = await authorizeRequest(
        routed,
        env,
        requiredScopes(routed),
      );
      const allowAnonymous = logical.startsWith("/api/") && mount.startsWith("/chatgpt-plugin/");
      let creator = identity;
      const cookies: string[] = [];
      if (creator instanceof Response && allowAnonymous) {
        const issued = anonymousCreator(routed);
        creator = issued.identity;
        if (issued.cookie) cookies.push(issued.cookie);
      }
      if (creator instanceof Response) return creator;
      return withCookies(
        await projectApi(
          routed,
          env,
          creator.creatorId,
          creator.mode === "oauth" ? "oauth" : "local-development-only",
        ),
        cookies,
      );
    }
    if (/^\/(studio|play|room|replay)\//.test(url.pathname)) {
      const identity = await authorizeRequest(routed, env, ["godesk:read"]);
      if (identity instanceof Response && !mount.startsWith("/chatgpt-plugin/")) {
        const login = new URL("/login", url.origin);
        login.searchParams.set("returnTo", `${incoming.pathname}${incoming.search}`);
        return Response.redirect(login, 302);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
