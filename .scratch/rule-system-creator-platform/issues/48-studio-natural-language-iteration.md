# 48 — Same-project natural-language Studio iteration

Type: task
Status: resolved

## Question

Can a creator send one focused natural-language follow-up from the same Web
Studio project, get a durable next version, and continue into automated
self-play without copying the request back into Codex or editing JSON?

## Answer

Yes, for the first bounded vertical slice: Studio accepts one explicit action
description rewrite. The Worker stores the original prompt as a creator-authored
Source Library entry, applies a version-checked `update_rule_system` patch with
`ai-proposed` action provenance, preserves an executable Kernel for descriptive
edits, and returns a durable `iterate-rule-system` job result. Studio then
compiles the next immutable Build and runs seed `42` bot self-play whenever the
Build is executable. A Finding can be selected so the following Build and
compile Changeset retain `basedOnFindingId` lineage.

Unsupported rule-number, action-shape, and victory-condition requests fail
without a mutation. Those changes continue through structured Rule System
operations or Codex's existing Finding workflow; no broad prose interpreter,
compatibility layer, or silent fallback was added.

## Acceptance

- `worker/rule-system-iteration.test.ts`: 3/3 parser tests pass, covering
  Chinese ordinal/label forms, English form, unsupported requests, and unknown
  actions.
- `worker/projects.test.ts` focused HTTP test passes: the same project receives
  a new Rule System version, retains `runtimeSupport.status: executable`,
  preserves the prompt Source, compiles a distinct immutable Build, completes
  a seed `42` bot Playtest, and leaves project version unchanged after an
  unsupported request.
- Focused MCP test passes: `submit_job` exposes and tracks the same bounded
  `iterate-rule-system` contract.
- `pnpm typecheck`, `src/creator/CreatorWorkspace.test.ts` (23/23), and
  `git diff --check` pass.

This is local automated and agent-operated evidence. It is not a real-person
playtest, public deployment, OAuth installation, or fresh public Plugin
discovery.
