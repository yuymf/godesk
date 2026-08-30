# 12 — Turn a Finding into a focused same-project iteration

Type: task
Status: resolved

Blocked by: 11

## Question

Can Codex act on a persisted Validation Finding instead of stopping after
displaying the `nextChange` note?

## Answer

The Plugin now includes the model-invoked `iterate-from-finding` Skill. It
resolves the same Game Project, reads the Finding and motivating evidence,
translates one `nextChange` into the smallest version-checked patch, compiles
an immutable Build, reruns fixed-seed self-play, compares the new Replay with
the old evidence, and optionally records a new evidence-labelled Finding.
The original Build, Replay, Hypothesis, and Finding remain immutable.

The validation and basics Skills route explicit follow-up requests to this
workflow. No server-side prose interpreter or compatibility layer was added;
Codex remains responsible for interpreting the creator's intent and GoDesk
remains responsible for versioning, execution, and evidence persistence.

## Verification

- The Skill was initialized with the repository's Skill Creator tooling and
  passes `quick_validate.py`.
- Plugin bundle verification discovers the new Skill and rejects stale
  protocol vocabulary.
- The local creator loop still verifies same-project actionable Finding,
  immutable Build revision, fixed-seed self-play, Shared Session, and Replay.
