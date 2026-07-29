# 06 — Authenticate creators and isolate Game Projects

**What to build:** A creator uses one GoDesk identity across Web Editor and MCP,
and every project read or write is tenant-scoped with an OAuth flow suitable
for Codex remote MCP.

**Blocked by:** 04 — Control Game Projects through remote MCP.

**Status:** implementation-complete-live-configuration-pending

- [x] GoDesk exposes the required protected-resource and authorization-server
      metadata and supports authorization code plus PKCE.
- [x] Tokens are validated for issuer, audience, expiry, scope, and creator on
      every request.
- [x] Web Editor and MCP resolve the same creator and accessible Game Projects.
- [x] Cross-creator project reads, writes, editor URLs, jobs, and room controls
      are rejected.
- [x] Local test authentication is explicit and cannot be confused with live
      OAuth evidence.

## Verification

- The resource server publishes RFC 9728 metadata, an OAuth discovery
  challenge, and per-tool OAuth security metadata.
- Web login implements authorization code plus S256 PKCE and stores only the
  short-lived validated access token in an HttpOnly Secure cookie.
- Every API and MCP request resolves a creator from the bearer token or web
  session; project Durable Objects are named by that creator.
- Claim tests reject invalid issuer, audience, expiry, not-before, scope, and
  creator. Integration tests prove creator B cannot read creator A's project
  and non-local unconfigured hosts fail closed with 401.
- Localhost is visibly labelled `Local development identity · 非线上 OAuth 证据`.

## Remaining live gate

An established OAuth provider must still be configured with issuer, audience,
web client ID, and web client secret before live OAuth can be claimed. No
production provider credentials are present in this checkout, so live login is
not yet verified.
