import { describe, expect, it, vi } from "vitest";
import { authorizationMetadata, validateTokenClaims } from "./auth";

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
