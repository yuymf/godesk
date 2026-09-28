import { describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  authorizeRequest,
  authorizationMetadata,
  protectedResourceMetadata,
  validateAccessClaims,
  validateTokenClaims,
} from "./auth";

const expected = {
  issuer: "https://auth.godesk.test",
  audience: "https://godesk.test/mcp",
  requiredScopes: ["godesk:read", "godesk:write"],
  nowSeconds: 1_000,
};

describe("OAuth token claim validation", () => {
  const valid = {
    iss: expected.issuer,
    aud: expected.audience,
    sub: "creator-a",
    exp: 2_000,
    nbf: 900,
    scope: "godesk:read godesk:write",
  };

  it("resolves the creator only after all resource checks pass", () => {
    expect(validateTokenClaims(valid, expected)).toEqual({
      creatorId: "creator-a",
      mode: "oauth",
      scopes: ["godesk:read", "godesk:write"],
    });
  });

  it.each([
    ["issuer", { ...valid, iss: "https://attacker.test" }],
    ["audience", { ...valid, aud: "https://other-resource.test" }],
    ["expiry", { ...valid, exp: 999 }],
    ["not-before", { ...valid, nbf: 1_001 }],
    ["scope", { ...valid, scope: "godesk:read" }],
    ["creator", { ...valid, sub: undefined }],
  ])("rejects an invalid %s claim", (_name, payload) => {
    expect(() => validateTokenClaims(payload, expected)).toThrow();
  });
});

describe("Managed OAuth Access authorization", () => {
  const teamIssuer = "https://managed-test.cloudflareaccess.com";
  const oidcIssuer = `${teamIssuer}/cdn-cgi/access/sso/oidc/web-client`;
  const accessAudience = "managed-app-aud";
  const env = {
    GODESK_AUTH_ISSUER: oidcIssuer,
    GODESK_AUTH_AUDIENCE: "web-client",
    GODESK_ACCESS_AUD: accessAudience,
  } as unknown as Env;
  const signingKeys = generateKeyPair("RS256");

  async function signedAccessJwt(claims: Record<string, unknown> = {}) {
    const { privateKey, publicKey } = await signingKeys;
    const jwk = await exportJWK(publicKey);
    const token = await new SignJWT({
      sub: "managed-creator",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "managed-key" })
      .setIssuer(teamIssuer)
      .setAudience(accessAudience)
      .setExpirationTime("1h")
      .sign(privateKey);
    return { token, jwk: { ...jwk, kid: "managed-key", alg: "RS256", use: "sig" } };
  }

  it("accepts a signed Access assertion before an opaque Bearer token", async () => {
    const { token, jwk } = await signedAccessJwt();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ keys: [jwk] }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await authorizeRequest(new Request("https://godesk.example/chatgpt-plugin/mcp", {
        headers: {
          "cf-access-jwt-assertion": token,
          authorization: "Bearer oauth:opaque-client-token",
        },
      }), env, ["godesk:read", "godesk:write"]);
      expect(result).toEqual({
        creatorId: "managed-creator",
        mode: "oauth",
        scopes: ["godesk:read", "godesk:write"],
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `${teamIssuer}/cdn-cgi/access/certs`,
        expect.anything(),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("accepts a signed Access Bearer JWT when no assertion is forwarded", async () => {
    const { token, jwk } = await signedAccessJwt();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ keys: [jwk] })));
    try {
      expect(await authorizeRequest(new Request("https://godesk.example/chatgpt-plugin/mcp", {
        headers: { authorization: `Bearer ${token}` },
      }), env, ["godesk:read"])).toMatchObject({ creatorId: "managed-creator" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a signed SaaS OIDC Bearer token on web discovery", async () => {
    const { privateKey, publicKey } = await signingKeys;
    const jwk = await exportJWK(publicKey);
    const token = await new SignJWT({ sub: "web-creator", scope: "godesk:read" })
      .setProtectedHeader({ alg: "RS256", kid: "web-key" })
      .setIssuer(oidcIssuer)
      .setAudience("web-client")
      .setExpirationTime("1h")
      .sign(privateKey);
    const discoveryUrl = `${oidcIssuer}/.well-known/openid-configuration`;
    const jwksUrl = `${oidcIssuer}/keys`;
    const fetchMock = vi.fn((url: string) => Promise.resolve(Response.json(
      url === discoveryUrl
        ? {
            issuer: oidcIssuer,
            authorization_endpoint: `${oidcIssuer}/authorize`,
            token_endpoint: `${oidcIssuer}/token`,
            jwks_uri: jwksUrl,
          }
        : { keys: [{ ...jwk, kid: "web-key", alg: "RS256", use: "sig" }] },
    )));
    vi.stubGlobal("fetch", fetchMock);
    try {
      expect(await authorizeRequest(new Request("https://godesk.example/api/projects", {
        headers: { authorization: `Bearer ${token}` },
      }), env, ["godesk:read"])).toMatchObject({ creatorId: "web-creator" });
      expect(fetchMock).toHaveBeenCalledWith(discoveryUrl);
      expect(fetchMock).toHaveBeenCalledWith(jwksUrl, expect.anything());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an Access assertion for another application AUD", async () => {
    const { token, jwk } = await signedAccessJwt();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ keys: [jwk] })));
    try {
      const result = await authorizeRequest(new Request("https://godesk.example/chatgpt-plugin/mcp", {
        headers: { "cf-access-jwt-assertion": token },
      }), { ...env, GODESK_ACCESS_AUD: "other-application" } as unknown as Env, ["godesk:read"]);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails closed when the Access AUD tag has not been configured", async () => {
    const result = await authorizeRequest(new Request("https://godesk.example/chatgpt-plugin/mcp", {
      headers: { "cf-access-jwt-assertion": "signed.jwt.value" },
    }), { ...env, GODESK_ACCESS_AUD: "" } as unknown as Env, ["godesk:read"]);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});

describe("OAuth protected resource metadata", () => {
  it.each([
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/chatgpt-plugin/mcp",
  ])("advertises the Access team Managed OAuth AS for DCR at %s", async (path) => {
    const teamOrigin = "https://test-team.cloudflareaccess.com";
    const issuer = `${teamOrigin}/cdn-cgi/access/sso/oidc/test-client`;
    const response = protectedResourceMetadata(
      new Request(`https://godesk.test${path}`),
      { GODESK_AUTH_ISSUER: issuer } as unknown as Env,
    );
    const metadata = await response.json<{ authorization_servers: string[] }>();

    expect(metadata.authorization_servers).toEqual([teamOrigin]);
    expect(metadata.authorization_servers[0]).not.toBe(issuer);
    expect(metadata.authorization_servers[0]).not.toContain("/cdn-cgi/access/sso/oidc/");
  });

  it.each([
    "https://test-team.cloudflareaccess.com",
    "https://auth.example.test/tenant/",
    "https://test-team.cloudflareaccess.com.example.test/tenant",
    "",
  ])("preserves other configured issuers or no issuer: %s", async (issuer) => {
    const response = protectedResourceMetadata(
      new Request("https://godesk.test/.well-known/oauth-protected-resource"),
      { GODESK_AUTH_ISSUER: issuer } as unknown as Env,
    );

    expect(await response.json()).toMatchObject({
      authorization_servers: issuer ? [issuer] : [],
    });
  });
});

describe("OAuth discovery", () => {
  function discoveryBody(
    issuer: string,
    extras: Record<string, unknown> = {},
  ) {
    return {
      issuer,
      authorization_endpoint: `${issuer.replace(/\/+$/, "")}/authorize`,
      token_endpoint: `${issuer.replace(/\/+$/, "")}/oauth/token`,
      jwks_uri: `${issuer.replace(/\/+$/, "")}/.well-known/jwks.json`,
      ...extras,
    };
  }

  it("preserves a trailing slash issuer while building one valid discovery URL", async () => {
    const issuer = "https://tenant.example.test/";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        discoveryBody(issuer, {
          code_challenge_methods_supported: ["S256"],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizationMetadata({ GODESK_AUTH_ISSUER: issuer } as unknown as Env),
    ).resolves.toMatchObject({ issuer });
    expect(fetchMock).toHaveBeenCalledWith(
      `${issuer}.well-known/openid-configuration`,
    );
    vi.unstubAllGlobals();
  });

  it("keeps web discovery on SaaS OIDC and accepts omitted PKCE methods", async () => {
    const issuer = "https://test-team.cloudflareaccess.com/cdn-cgi/access/sso/oidc/web-client";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(discoveryBody(issuer)),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizationMetadata({ GODESK_AUTH_ISSUER: issuer } as unknown as Env),
    ).resolves.toMatchObject({
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${issuer}/.well-known/openid-configuration`,
    );
    vi.unstubAllGlobals();
  });

  it("accepts metadata with an empty code_challenge_methods_supported list", async () => {
    const issuer = "https://access-empty-pkce.example.test";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        discoveryBody(issuer, { code_challenge_methods_supported: [] }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizationMetadata({ GODESK_AUTH_ISSUER: issuer } as unknown as Env),
    ).resolves.toMatchObject({ issuer });
    vi.unstubAllGlobals();
  });

  it("rejects metadata that advertises PKCE without S256", async () => {
    const issuer = "https://access-plain-pkce.example.test";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        discoveryBody(issuer, {
          code_challenge_methods_supported: ["plain"],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      authorizationMetadata({ GODESK_AUTH_ISSUER: issuer } as unknown as Env),
    ).rejects.toThrow("oauth_metadata_invalid");
    vi.unstubAllGlobals();
  });
});

describe("Cloudflare Access claim validation", () => {
  const accessExpected = {
    issuer: "https://godesk-yumengfan220.cloudflareaccess.com",
    audience: "godesk-access-audience",
    nowSeconds: 1_000,
  };
  const accessPayload = {
    iss: accessExpected.issuer,
    aud: [accessExpected.audience],
    sub: "access-user-id",
    email: "creator@example.com",
    exp: 2_000,
  };

  it("maps a valid Access JWT to one tenant identity", () => {
    expect(validateAccessClaims(accessPayload, accessExpected)).toEqual({
      creatorId: "access-user-id",
      mode: "oauth",
      scopes: ["godesk:read", "godesk:write"],
    });
  });

  it("uses Access token scopes when present instead of request-derived grants", () => {
    expect(validateAccessClaims({
      ...accessPayload,
      scope: "godesk:read",
    }, accessExpected)).toEqual({
      creatorId: "access-user-id",
      mode: "oauth",
      scopes: ["godesk:read"],
    });
  });

  it.each([
    ["issuer", { ...accessPayload, iss: "https://attacker.test" }],
    ["audience", { ...accessPayload, aud: ["other-app"] }],
    ["expiry", { ...accessPayload, exp: 999 }],
    ["creator", { ...accessPayload, sub: undefined }],
  ])("rejects an invalid Access %s claim", (_name, payload) => {
    expect(() => validateAccessClaims(payload, accessExpected)).toThrow();
  });
});
