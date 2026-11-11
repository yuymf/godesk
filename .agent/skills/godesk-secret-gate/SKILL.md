---
name: godesk-secret-gate
description: Use when scanning or triaging secrets in yuymf/godesk.
version: 1.0.0
metadata:
  hermes:
    tags: [godesk, secrets, gitleaks, cloudflare]
    category: devops
---

# godesk public-repo secret gate

## When to Use
Any change that might put a Cloudflare identifier or credential into yuymf/godesk, or a future auditor asking whether the 2026-10 history should be rewritten.

## Why it exists
On 2026-10-28 real Cloudflare Zero Trust *identifiers* (not credentials) landed in this PUBLIC repo and were only removed by hand. GitHub push protection is on, but non-provider patterns are a paid GitHub Secret Protection feature, so the repo owns the rule set.

## Commands (offline after first bootstrap)
```bash
cd /home/halyu/Downloads/Code/godesk
pnpm secrets:check            # staged, also .git/hooks/pre-commit
pnpm secrets:check:all        # every file git would publish (CI)
pnpm secrets:check:canary     # rules still fire, allowlist stays narrow
pnpm secrets:check:history    # full git history, audits only
pnpm secrets:install-hook     # opt-in hook on a new clone
```
Pinned binary: gitleaks 8.30.1, SHA256 in `scripts/gitleaks.lock.json`, cached at `~/.cache/godesk-secretscan/v8.30.1/<os>_<arch>/gitleaks`. First run downloads; later runs never need the network. Override with `GODESK_GITLEAKS_BIN`.

## Policy rules (`.gitleaks.toml`)
Catches the class that leaked: Cloudflare Account ID, Access team domain, Access SaaS OIDC issuer, AUD tags, `GODESK_*` hex literals, plus upstream `generic-api-key`.
Allowlist is **line-shaped only** (never a whole file): `wrangler types` banner hash, JSDoc `@example`, `idempotencyKey:` test labels, `REPLACE_ME` / `godesk-placeholder.invalid`, and the enumerated fake hosts `test-team` / `managed-test`. If a canary starts failing, the allowlist got too wide — shrink it, don't add path exemptions.
Findings always print redacted: CI logs of a public repo are public.

## History triage (do not rewrite)
`pnpm secrets:check:history` → 18 findings / 6 commits. Re-extracting each matched line vs `.dev.vars` credential values = **0 hits**. No `GODESK_WEB_CLIENT_SECRET` / `GODESK_SHARE_SECRET` / `GODESK_WEB_CLIENT_ID` / API token value was ever in git → **do not rotate**. Identifier residue (Account ID / team domain / OIDC issuer / AUD) is displayed in the Zero Trust dashboard by design; the team domain is still reconstructable from the `workers.dev` hostname published in `scripts/verify-production-smoke.mjs`. `forkCount=0`, not a template. BFG/filter-repo would break clones and leave copies in GH caches/forks. Decision is documented in README «Secret gate (and the 2026-10 history note)». Future auditors: identifier-class findings are triaged, not open incidents.

## GitHub-side (as of 2026-10-29, PAT of a free user)
```
secret_scanning: enabled
secret_scanning_push_protection: enabled     # only blocks future pushes
secret_scanning_non_provider_patterns: disabled  # paid
secret_scanning_validity_checks: disabled        # paid
dependabot_security_updates: disabled            # left off; not this class of leak
```
A PATCH that asks for the two paid fields silently leaves them disabled; don't retry.

## Pitfalls
- `wrangler types` copies var values into generated `Env` literal types. Scanning only `wrangler.jsonc` is not enough; the gate covers `worker-configuration.d.ts` too. HEAD currently has none of the real values.
- Don't put a real-looking `https://<team>.cloudflareaccess.com` literal in `scripts/secret-scan.mjs` itself (the canary fixtures assemble the host at runtime).
- `/home/halyu/.local/bin/gh` is a content-guard wrapper. `gh pr create --body` fail-closes when the social venv is missing (`No module named 'content_guard'`). For security-ops PRs, call `/usr/local/bin/gh` directly; do not set `CONTENT_GUARD_BYPASS`.
- This host (and the Mac) currently get TLS unexpected-EOF against `godesk.yumengfan220.workers.dev` while generic Cloudflare endpoints work. Don't diagnose Worker auth from here; use the last green `pnpm verify:production` step in Actions (login 302, `/chatgpt-plugin/mcp` Access challenge) instead of inventing a local curl.
- Never print identifier/credential values. Mask as `<len=N>` or sha256[:12]. Never rotate on identifier-class residue.
