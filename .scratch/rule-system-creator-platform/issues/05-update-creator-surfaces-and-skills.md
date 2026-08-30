# 05 - Update creator surfaces and Skills

Type: task
Status: resolved

Blocked by: 04

Rewrite the website, Web Studio, README, and thin Plugin Skills around idea-first
rule-game creation, URL-only friend joining, and validation. Remove active
tabletop-only and Web Editor terminology while keeping rights/provenance limits.

## Acceptance

- UI copy and Skills use the CONTEXT.md language.
- The primary CTA supports idea-only creation and opens either an executable
  Shared Session or the editable draft in Web Studio without fabricating rules.
- Friends are never instructed to install Codex.

## Answer

README, installation copy, Web Studio, Plugin metadata, and all repo-local
Skills now use the Rule System vocabulary. The home composer accepts one idea
without a file. A sufficiently explicit, supported Rule System compiles and
opens a Shared Session; an underspecified idea opens as an honest draft in Web
Studio. The shareable-prototype Skill can author and disclose an explicit
minimal Kernel before compiling. The invitation explicitly tells friends to
open the browser URL without installing Codex.

Added `validate-game-idea` as a distinct model-invoked Skill for the core
Design Hypothesis and Validation Finding workflow. Updated existing Skills to
use current MCP views (`entities`, `surface`, `outcomes`, `validation`) and
Presentation Floor terminology.

## Verification

- All 10 Skill folders pass `quick_validate.py`.
- `pnpm test`: 2 files, 17 tests passed.
- `pnpm test:worker`: 4 files, 66 tests passed.
- `pnpm typecheck`: passed.
- `git diff --check`: passed.
