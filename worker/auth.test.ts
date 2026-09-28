import { describe, expect, it, vi } from "vitest";
import {
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
