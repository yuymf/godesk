import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { isPublicMount, mountHref } from "../src/public-mount";

const READ_SCOPE = "godesk:read";
const WRITE_SCOPE = "godesk:write";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "godesk.test"]);

interface AuthEnv {
  GODESK_AUTH_ISSUER?: string;
  GODESK_AUTH_AUDIENCE?: string;
  GODESK_WEB_CLIENT_ID?: string;
  GODESK_WEB_CLIENT_SECRET?: string;
}

interface AuthorizationMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  code_challenge_methods_supported?: string[];
}

export interface CreatorIdentity {
  creatorId: string;
  mode: "local-development" | "oauth";
  scopes: string[];
}

const jwksByUri = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const metadataByIssuer = new Map<string, Promise<AuthorizationMetadata>>();

function authEnv(env: Env): AuthEnv {
  return env as Env & AuthEnv;
}

function configuredIssuer(env: Env) {
  return authEnv(env).GODESK_AUTH_ISSUER?.trim();
}

function cookie(request: Request, name: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function scopes(payload: JWTPayload) {
  if (typeof payload.scope === "string") {
    return payload.scope.split(/\s+/).filter(Boolean);
  }
  const claim = payload.scopes;
  return Array.isArray(claim)
    ? claim.filter((scope): scope is string => typeof scope === "string")
    : [];
}

export function validateTokenClaims(
  payload: JWTPayload,
  expected: {
    issuer: string;
    audience: string;
    requiredScopes: string[];
    nowSeconds?: number;
  },
): CreatorIdentity {
  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1_000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const grantedScopes = scopes(payload);
  if (payload.iss !== expected.issuer) throw new Error("invalid_issuer");
  if (!audience.includes(expected.audience)) throw new Error("invalid_audience");
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("token_expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("token_not_active");
  }
  if (
    expected.requiredScopes.some((scope) => !grantedScopes.includes(scope))
  ) {
    throw new Error("insufficient_scope");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("missing_creator");
  }
  return {
    creatorId: payload.sub,
    mode: "oauth",
    scopes: grantedScopes,
  };
}

export function validateAccessClaims(
  payload: JWTPayload,
  expected: {
    issuer: string;
    audience: string;
    nowSeconds?: number;
  },
): CreatorIdentity {
  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1_000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== expected.issuer) throw new Error("invalid_issuer");
  if (!audience.includes(expected.audience)) throw new Error("invalid_audience");
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("token_expired");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("missing_creator");
  }
  const grantedScopes = scopes(payload);
  return {
    creatorId: payload.sub,
    mode: "oauth",
    scopes: grantedScopes.length ? grantedScopes : [READ_SCOPE, WRITE_SCOPE],
  };
}

export async function authorizationMetadata(env: Env) {
  const issuer = configuredIssuer(env);
  if (!issuer) throw new Error("oauth_not_configured");
  let metadata = metadataByIssuer.get(issuer);
  if (!metadata) {
    const discoveryUrl =
      `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
    metadata = fetch(discoveryUrl).then(
      async (response) => {
        if (!response.ok) throw new Error("oauth_discovery_failed");
        const value = await response.json<AuthorizationMetadata>();
        if (
          value.issuer !== issuer ||
          !value.authorization_endpoint ||
          !value.token_endpoint ||
          !value.jwks_uri ||
          !value.code_challenge_methods_supported?.includes("S256")
        ) {
          throw new Error("oauth_metadata_invalid");
        }
        return value;
      },
    );
    metadataByIssuer.set(issuer, metadata);
  }
  return metadata;
}

function requestMount(request: Request) {
  return request.headers.get("x-godesk-mount") ?? new URL(request.url).pathname;
}

function mcpResourceUrl(request: Request) {
  const origin = new URL(request.url).origin;
  return `${origin}${mountHref("/mcp", requestMount(request))}`;
}

function oauthCallbackUrl(request: Request) {
  const origin = new URL(request.url).origin;
  return `${origin}${mountHref("/oauth/callback", requestMount(request))}`;
}

function challenge(request: Request, scope: string, description: string) {
  const origin = new URL(request.url).origin;
  const metadataUrl = isPublicMount(requestMount(request))
    ? `${origin}/.well-known/oauth-protected-resource/chatgpt-plugin/mcp`
    : `${origin}/.well-known/oauth-protected-resource`;
  return new Response(
    JSON.stringify({ error: "unauthorized", error_description: description }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate":
          `Bearer resource_metadata="${metadataUrl}", scope="${scope}", ` +
          `error="invalid_token", error_description="${description}"`,
      },
    },
  );
}

function localIdentity(request: Request): CreatorIdentity | null {
  if (!LOCAL_HOSTS.has(new URL(request.url).hostname)) return null;
  const creatorId =
    request.headers.get("x-godesk-dev-creator")?.trim() || "local-creator";
  return {
    creatorId,
    mode: "local-development",
    scopes: [READ_SCOPE, WRITE_SCOPE],
  };
}

const ANON_COOKIE = "__Host-GODESK_ANON";

export function anonymousCreator(request: Request) {
  const existing = cookie(request, ANON_COOKIE);
  if (existing?.startsWith("anon_")) {
    return {
      identity: {
        creatorId: existing,
        mode: "oauth" as const,
        scopes: [READ_SCOPE, WRITE_SCOPE],
      },
    };
  }
  const creatorId = `anon_${crypto.randomUUID()}`;
  return {
    identity: {
      creatorId,
      mode: "oauth" as const,
      scopes: [READ_SCOPE, WRITE_SCOPE],
    },
    cookie: loginCookie(ANON_COOKIE, creatorId, 60 * 60 * 24 * 30),
  };
}

export function withCookies(response: Response, cookies: string[]) {
  if (!cookies.length) return response;
  const headers = new Headers(response.headers);
  for (const value of cookies) headers.append("set-cookie", value);
  return new Response(response.body, { status: response.status, headers });
}

export async function authorizeRequest(
  request: Request,
  env: Env,
  requiredScopes: string[],
): Promise<CreatorIdentity | Response> {
  const local = localIdentity(request);
  if (local) return local;
  const config = authEnv(env);
  const issuer = configuredIssuer(env);
  if (!issuer || !config.GODESK_AUTH_AUDIENCE) {
    return challenge(request, requiredScopes.join(" "), "OAuth is not configured.");
  }
  const accessAssertion = request.headers.get("cf-access-jwt-assertion");
  if (accessAssertion) {
    try {
      const certsUri = `${issuer.replace(/\/+$/, "")}/cdn-cgi/access/certs`;
      let jwks = jwksByUri.get(certsUri);
      if (!jwks) {
        jwks = createRemoteJWKSet(new URL(certsUri));
        jwksByUri.set(certsUri, jwks);
      }
      const verified = await jwtVerify(accessAssertion, jwks, {
        issuer,
        audience: config.GODESK_AUTH_AUDIENCE,
      });
      const identity = validateAccessClaims(verified.payload, {
        issuer,
        audience: config.GODESK_AUTH_AUDIENCE,
      });
      if (requiredScopes.some((scope) => !identity.scopes.includes(scope))) {
        return challenge(request, requiredScopes.join(" "), "insufficient_scope");
      }
      return identity;
    } catch (reason) {
      const description =
        reason instanceof Error ? reason.message : "Access token validation failed.";
      return challenge(request, requiredScopes.join(" "), description);
    }
  }
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : cookie(request, "__Host-GODESK_SESSION");
  if (!token) {
    return challenge(request, requiredScopes.join(" "), "Login is required.");
  }
  try {
    const metadata = await authorizationMetadata(env);
    let jwks = jwksByUri.get(metadata.jwks_uri);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(metadata.jwks_uri));
      jwksByUri.set(metadata.jwks_uri, jwks);
    }
    const verified = await jwtVerify(token, jwks, {
      issuer,
      audience: config.GODESK_AUTH_AUDIENCE,
    });
    return validateTokenClaims(verified.payload, {
      issuer,
      audience: config.GODESK_AUTH_AUDIENCE,
      requiredScopes,
    });
  } catch (reason) {
    const description =
      reason instanceof Error ? reason.message : "Token validation failed.";
    return challenge(request, requiredScopes.join(" "), description);
  }
}

export function protectedResourceMetadata(request: Request, env: Env) {
  const url = new URL(request.url);
  const issuer = configuredIssuer(env);
  const prefixed =
    url.pathname.endsWith("/chatgpt-plugin/mcp") ||
    isPublicMount(requestMount(request));
  return Response.json({
    resource: prefixed ? `${url.origin}/chatgpt-plugin/mcp` : `${url.origin}/mcp`,
    authorization_servers: issuer ? [issuer] : [],
    scopes_supported: [READ_SCOPE, WRITE_SCOPE],
    resource_documentation: `${url.origin}/chatgpt-plugin`,
    bearer_methods_supported: ["header"],
  });
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function loginCookie(name: string, value: string, maxAge = 600) {
  return `${name}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

function safeReturnTo(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function startWebLogin(request: Request, env: Env) {
  const config = authEnv(env);
  if (!config.GODESK_WEB_CLIENT_ID || !config.GODESK_AUTH_AUDIENCE) {
    return new Response("GoDesk web OAuth is not configured.", { status: 503 });
  }
  const metadata = await authorizationMetadata(env);
  const state = randomToken();
  const verifier = randomToken();
  const challenge = base64Url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.GODESK_WEB_CLIENT_ID);
  url.searchParams.set("redirect_uri", oauthCallbackUrl(request));
  url.searchParams.set("scope", `openid profile ${READ_SCOPE} ${WRITE_SCOPE}`);
  url.searchParams.set("audience", config.GODESK_AUTH_AUDIENCE);
  url.searchParams.set("resource", mcpResourceUrl(request));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  const headers = new Headers({ location: url.toString() });
  headers.append("set-cookie", loginCookie("__Host-GODESK_LOGIN_STATE", state));
  headers.append(
    "set-cookie",
    loginCookie("__Host-GODESK_LOGIN_VERIFIER", verifier),
  );
  headers.append(
    "set-cookie",
    loginCookie(
      "__Host-GODESK_LOGIN_RETURN",
      encodeURIComponent(returnTo),
    ),
  );
  return new Response(null, { status: 302, headers });
}

export async function finishWebLogin(request: Request, env: Env) {
  const config = authEnv(env);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookie(request, "__Host-GODESK_LOGIN_STATE");
  const verifier = cookie(request, "__Host-GODESK_LOGIN_VERIFIER");
  if (
    !code ||
    !state ||
    !storedState ||
    state !== storedState ||
    !verifier ||
    !config.GODESK_WEB_CLIENT_ID ||
    !config.GODESK_WEB_CLIENT_SECRET ||
    !config.GODESK_AUTH_AUDIENCE
  ) {
    return new Response("Invalid OAuth callback.", { status: 400 });
  }
  const metadata = await authorizationMetadata(env);
  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.GODESK_WEB_CLIENT_ID,
      client_secret: config.GODESK_WEB_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      redirect_uri: oauthCallbackUrl(request),
      resource: mcpResourceUrl(request),
    }),
  });
  if (!response.ok) {
    return new Response("OAuth token exchange failed.", { status: 502 });
  }
  const tokens = await response.json<{ access_token?: string; expires_in?: number }>();
  if (!tokens.access_token) {
    return new Response("OAuth provider returned no access token.", {
      status: 502,
    });
  }
  const validationRequest = new Request(request.url, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const identity = await authorizeRequest(validationRequest, env, [
    READ_SCOPE,
    WRITE_SCOPE,
  ]);
  if (identity instanceof Response) return identity;
  const returnTo = safeReturnTo(
    decodeURIComponent(cookie(request, "__Host-GODESK_LOGIN_RETURN") ?? "/"),
  );
  const headers = new Headers({ location: returnTo });
  headers.append(
    "set-cookie",
    loginCookie(
      "__Host-GODESK_SESSION",
      tokens.access_token,
      Math.min(tokens.expires_in ?? 3_600, 3_600),
    ),
  );
  for (const name of [
    "__Host-GODESK_LOGIN_STATE",
    "__Host-GODESK_LOGIN_VERIFIER",
    "__Host-GODESK_LOGIN_RETURN",
  ]) {
    headers.append("set-cookie", loginCookie(name, "", 0));
  }
  return new Response(null, { status: 302, headers });
}

export function requiredScopes(request: Request) {
  return request.method === "GET" || request.method === "HEAD"
    ? [READ_SCOPE]
    : [READ_SCOPE, WRITE_SCOPE];
}
