# 04 - Close the validation learning loop

Type: task
Status: resolved

Blocked by: 03

Add Design Hypotheses and Validation Findings to the authoritative Game Project.
A Finding references one hypothesis and one build or Shared Session, records
human or automated evidence, and classifies it as supported, refuted, or
inconclusive.

## Acceptance

- Version-checked HTTP and MCP mutations create hypotheses and findings.
- Human evidence cannot be synthesized from an automated bot run.
- Web Studio displays the question, evidence type, verdict, and source session.

## Answer

The Game Project now owns versioned Design Hypotheses and Validation Findings.
Both HTTP and MCP use the versioned `apply_project_patch` seam; `read_project` adds
one bounded `validation` view. Automated evidence must reference a persisted
bot playtest for the same Build. Human evidence must reference a Shared Session
for the same Build with two claimed seats and at least one accepted action, so a
bot run cannot be relabeled as human evidence.

Web Studio now provides persistent-label forms for hypotheses and findings and
shows the verdict, Build, and evidence type. Human evidence is explicitly shown
as a creator attestation, not independent acceptance proof.

## Verification

- `pnpm test:worker`: 4 files, 66 tests passed.
- `pnpm test`: 2 files, 17 tests passed.
- `pnpm typecheck`: passed.
- `git diff --check`: passed.
