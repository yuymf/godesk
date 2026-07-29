import { describe, expect, it, vi } from "vitest";
import {
  authorizationMetadata,
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

describe("OAuth discovery", () => {
  it("preserves a trailing slash issuer while building one valid discovery URL", async () => {
    const issuer = "https://tenant.example.test/";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        issuer,
        authorization_endpoint: `${issuer}authorize`,
        token_endpoint: `${issuer}oauth/token`,
        jwks_uri: `${issuer}.well-known/jwks.json`,
        code_challenge_methods_supported: ["S256"],
      }),
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
});

describe("Cloudflare Access claim validation", () => {
  const accessExpected = {
    issuer: "https://godesk-yumengfan220.cloudflareaccess.com",
    audience: "godesk-access-audience",
    grantedScopes: ["godesk:read", "godesk:write"],
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

  it.each([
    ["issuer", { ...accessPayload, iss: "https://attacker.test" }],
    ["audience", { ...accessPayload, aud: ["other-app"] }],
    ["expiry", { ...accessPayload, exp: 999 }],
    ["creator", { ...accessPayload, sub: undefined }],
  ])("rejects an invalid Access %s claim", (_name, payload) => {
    expect(() => validateAccessClaims(payload, accessExpected)).toThrow();
  });
});
