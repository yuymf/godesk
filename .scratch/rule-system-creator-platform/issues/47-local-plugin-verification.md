# 47 — Local Plugin verification covers the current Skill set

Type: task
Status: resolved

## Question

Must the standard local Plugin verification command prove both the bundle
contract and the current local Skill / distribution set, without treating a
stale public repository as a local pass?

## Answer

Yes. `pnpm verify:plugin` exercises the local bundle and the local
distribution contract. `pnpm verify:plugin:public` stays a separate external
gate and may fail only at the publication boundary. Publishing the public
bundle remains `issues/19-public-plugin-distribution-sync.md`
(`ready-for-human`).

## Comments

- 2026-09-22: Stub added so map decision 47 matches an issue file. The
  decision was previously recorded as map item 45 (misaligned with issue 45)
  and in issue 19 comments.
