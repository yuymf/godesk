# 19 — Sync the public Plugin distribution with the current Rule System contract

Type: task
Status: resolved

Blocked by: None

## Question

Does the separately published `yuymf/godesk-plugin` bundle expose the current
installable GoDesk Skills and MCP contract?

## Answer

Yes. The `deploy.yml` public Plugin publish step synced `yuymf/godesk-plugin`
on 2026-10-03 (commit `e58e879`, "Sync GoDesk Plugin from yuymf/godesk"). Its
`plugins/godesk` tree and `README.md` are byte-identical to this repository's
`plugins/godesk` and `plugins/PUBLIC_README.md` at version
`0.2.0+codex.20260830` with the current 12 Skills.

A fresh Codex Desktop install from the public Marketplace is still a human
check; it is not covered by this verification.

## Verification

- 2026-10-05: `diff -r plugins/godesk <godesk-plugin>/plugins/godesk` and the
  README diff are empty.
- `pnpm verify:plugin` passes the local bundle and distribution contract.
- `pnpm verify:plugin:public` matches the remote manifest, MCP declaration and
  README; on unauthenticated networks the Skill-tree step can hit the GitHub
  API rate limit (HTTP 403).

## Comments

2026-08-12: The local verifier's stale hard-coded count of 11 Skills was
corrected to the current 12-Skill contract.

2026-10-05: Public distribution confirmed in sync; status set to resolved.
