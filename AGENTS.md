## Product charter

GoDesk is a ChatCut-style rule-game generator.

ChatCut is a Codex Plugin: a person installs it, uploads a video, and receives
a finished film they can use. GoDesk is the same shape for rule-orchestrated
games. A Creator or hobbyist installs the Plugin in Codex or opens the website,
uploads a script, a rulebook, or a written idea, and receives a playable
finished game others can join. A themed scoreboard or mechanism slice is not
delivery. Other people join through a URL and play together. They do not
install Codex.

The success bar is:

```text
source in -> playable finished game out -> others can play together
```

Web Studio and Codex operate the same Game Project. Immutable Builds, Shared
Sessions, and Replays exist so the generated game is real and joinable. Design
Hypotheses, Experiment Briefs, and Validation Findings are optional iteration
tools. They are not the product. A change that does not get someone closer to a
playable, shareable game is the wrong change.

Read `CONTEXT.md`, `docs/product/first-principles.md`, and
`docs/adr/0011-chatcut-playable-output-is-the-product.md` before exploring or
editing. Playability Floor (ADR 0012) is the share gate. Use glossary terms from `CONTEXT.md`. If work
contradicts an accepted ADR, surface it; do not silently override it.

## Playwright verification

Every feature development or modification must be verified with Playwright
against the user-visible path. Unit tests, Worker tests, and HTTP verifiers are
not a substitute. Do not call work done without a green `pnpm test:e2e`.

- Add or update a spec under `e2e/` that a person would recognize: upload or
  pick a source, reach a playable Shared Session, share or join, take an action.
- Run `pnpm test:e2e` locally and keep the CI Playwright job green.
- A screenshot of a static render is not verification. The spec must click,
  type, navigate, and assert the resulting play or share state.
- If the change is not user-visible, still cover the nearest user-visible
  outcome the change enables (for example a new Kernel must be playable in a
  Room through Playwright).
- Do not revive "validation platform" or "learning loop as the product" copy
  in user-facing surfaces, Plugin Skills, or agent docs.

## Agent skills

### Issue tracker

Issues and specs are tracked as local Markdown files under `.scratch/`. See
`docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.
