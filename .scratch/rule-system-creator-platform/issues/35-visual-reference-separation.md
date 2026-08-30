# Separate Visual References from Project Assets

Type: task
Status: resolved

## Question

Can a creator upload an image only to guide style without GoDesk silently
shipping those pixels as game art, then generate a distinct bindable asset with
the full relationship preserved?

## Answer

Yes. Every Source Library image now has exactly one first-class use:

- `visual-reference` guides generation and cannot bind to a Game Entity, Play
  Surface region, or presentation.
- `project-asset` may bind directly and appear in a Playable Build.

The home composer defaults uploaded images to Visual Reference and explains the
consequence before generation. Rulebook-harvested images are explicit Project
Assets. A generated Project Asset uses `basedOnSourceIds` to retain its visual
brief and every reference image that influenced it. Builds follow this
transitive dependency set, while an unbound reference does not become playable
content by accident.

The Worker rejects direct reference placement with
`visual_reference_not_bindable` and leaves the project version unchanged. It
also rejects missing generated-asset dependencies with
`source_dependency_not_found`.

## Acceptance

Fresh isolated acceptance used Project
`project_5affe4fc-4475-4c34-9d30-d1095d051efa`. Source
`source_job_34c556f1-d6f2-47c2-a454-d0bba16b5f60_image_1` was stored as a
Visual Reference and remained unbound after generation. Project Asset
`source_acceptance_generated_project_asset` was generated from that reference
plus creator brief `source_acceptance_reference_visual_brief`.

Build `build_a09f6450ed1c2631fdca938f` passed the Presentation Floor and retained
all three Source IDs. Seed 42 Playtest
`playtest_dd9e7fc6-d99f-42c9-81bb-85045988e9df` completed the shared target and
produced Replay `replay_04732034-0f76-43d0-856f-5a16ca63bc46`. Browser
self-play in Room `room_75123999-eb19-46a4-9d98-4c2e0ba41f7e` claimed seat 0,
submitted `调查`, and advanced from turn 0 / progress 0 to turn 1 / progress 2;
Replay `replay_ec146440-fb26-403e-b187-744cd25cb0b7` retained the action.

Studio visibly distinguished the reference and asset, displayed both generated
dependencies, and the immutable Build preview showed only the Project Asset.
This is local automated and agent-operated evidence, not a real-person
playtest or public Codex installation.

The full local matrix passed: frontend 2 files / 24 tests, Worker 4 files / 103
tests, typecheck, production build, local routes, creator loop, 16 MCP tools /
18 invariants, 11 Plugin Skills, and deployment dry-run. The separate read-only
public distribution check still fails exactly with
`public plugin version is stale`.
