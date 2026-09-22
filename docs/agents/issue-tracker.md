# Issue tracker: Local Markdown

Issues and specs (you may know a spec as a PRD) for this repo live as Markdown files in `.scratch/`.

The current product charter is `CONTEXT.md`, `docs/product/first-principles.md`,
and [ADR 0011](../adr/0011-chatcut-playable-output-is-the-product.md) /
[ADR 0012](../adr/0012-playability-floor-is-the-share-gate.md). See
[the ADR index](../adr/README.md). A feature `spec.md` may point there instead
of restating identity.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is a `Status:` line near the top of each issue file. Use the
  tracker words in `triage-labels.md`: `claimed`, `resolved`, `ready-for-human`,
  plus `needs-triage` / `needs-info` / `wontfix` when those apply
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
  Decision numbers must match `issues/NN-*.md`.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records a tracker word from `triage-labels.md`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open (`claimed` or no terminal status), unblocked, and unclaimed; first by number wins. `ready-for-human` is not agent-frontier.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer to the map's Decisions-so-far in `map.md`.
- **Human gate**: set `Status: ready-for-human` when the remaining work is an external publish, OAuth, or real-person playtest.
