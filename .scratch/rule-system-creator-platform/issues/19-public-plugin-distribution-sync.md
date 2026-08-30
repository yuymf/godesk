# 19 — Sync the public Plugin distribution with the current Rule System contract

Type: task
Status: ready-for-human

Blocked by: 18

## Question

Does the separately published `yuymf/godesk-plugin` bundle expose the current
installable GoDesk Skills and MCP contract?

## Answer

Not yet. The local checkout is on the current `0.2.0+codex.20260811` contract
with 12 Skills, Studio embedded self-play, and `participant-feedback` evidence,
while the public repository still exposes the older `0.1.0` tabletop-only
bundle. The repository now has a
read-only distribution verifier so this drift is explicit instead of being
reported as a successful public install.

Closing this issue requires authorized publication of the current thin Plugin
bundle to the separate public repository, followed by a fresh remote
manifest/MCP/Skill check and a new Codex Desktop install check. No Git or public
deployment mutation is authorized by this task.

## Verification

- `pnpm verify:plugin` passes both the local bundle and local distribution
  contract, including the current 12-Skill set.
- `pnpm verify:plugin:public` intentionally fails on the stale public Plugin
  version until the external repository is synchronized.
- Public OAuth, fresh-task tool discovery, and human playtesting remain separate
  acceptance gates.

## Comments

2026-08-12: The local verifier's stale hard-coded count of 11 Skills was
corrected to the current 12-Skill contract, and `pnpm verify:plugin` now runs
both the bundle and local distribution checks. The remote repository remains
unchanged and the public check still stops at `public plugin version is stale`.
