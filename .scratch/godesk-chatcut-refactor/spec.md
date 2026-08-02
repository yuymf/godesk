# GoDesk ChatCut-style creator platform

Status: ready-for-agent

## Problem Statement

GoDesk currently presents a browser-local, player-first upload-to-playable
prototype. It can ingest source files and demonstrate a seeded Manila slice,
but it is not an editable creator platform, does not expose an authenticated
remote MCP surface, has no authoritative cloud project state, and cannot be
installed into Codex through one natural-language request.

A tabletop creator should not have to operate a development repository or
learn internal schemas. They should be able to ask Codex to install GoDesk,
authenticate with GoDesk, enter a new GoDesk creation task, create or open a
Game Project, and use natural language to modify it while watching and
adjusting the same project in a visible Web Editor. GoDesk—not Codex or the
browser—must own project truth, compilation, playable runtime state, jobs,
version conflicts, and replay evidence.

The present player-first ADR and default route conflict with this product. They
must be superseded rather than retained as a second primary journey.

## Solution

Rebuild GoDesk as a ChatCut-style creator platform with four cooperating
surfaces:

1. A thin Codex Plugin contains GoDesk branding, workflow Skills, a remote MCP
   configuration, and installation metadata.
2. A GoDesk-hosted installation guide lets a creator begin with one sentence.
   In a supported Codex Desktop host, Codex uses the bundled CLI to install the
   plugin, complete GoDesk OAuth, verify the active plugin and MCP tools, and
   create and open a fresh GoDesk creation task. Unsupported hosts receive an
   exact desktop handoff; failed setup enters a specific recovery task and is
   never reported as success.
3. An authenticated GoDesk service is the system of record for Game Projects,
   Source Library entries, editable Game Definitions, immutable Playable
   Builds, durable jobs, playtests, rooms, accepted actions, and replays. The
   remote MCP server exposes controlled, goal-oriented reads and mutations over
   those services. Codex never writes storage directly and never acts as the
   deterministic rules runtime.
4. The GoDesk Web Editor is the visible work surface. Project creation and
   targeting return an exact editor handoff early. Creators can watch Codex
   work, inspect the source-linked Game Definition, edit it manually, compile a
   Playable Build, run deterministic playtests, enter a room, and review
   evidence. Codex refreshes relevant project state before nontrivial edits and
   uses optimistic version checks so manual changes are not overwritten.

The first complete vertical slice uses a general Game Project model and the
existing Manila fixture only as internal evidence. It must prove the full
install-to-edit-to-compile-to-playtest loop without claiming that the fixture is
commercially publishable or that arbitrary uploaded games are already fully
understood.

## User Stories

1. As a tabletop creator, I want to install GoDesk with one natural-language
   request, so that I do not need to translate a setup guide into terminal
   commands.
2. As a tabletop creator, I want the installation request to work only in a
   supported desktop host, so that a remote or web conversation does not claim
   it modified my local Codex installation.
3. As a tabletop creator, I want GoDesk's guide to locate the Codex Desktop
   bundled CLI, so that installation does not accidentally use an incompatible
   standalone CLI.
4. As a tabletop creator, I want Codex to install the GoDesk marketplace and
   plugin for me, so that setup is an outcome rather than a tutorial.
5. As a tabletop creator, I want GoDesk OAuth to open during setup, so that the
   plugin can access only projects belonging to my authenticated account.
6. As a tabletop creator, I want installation, authentication, plugin status,
   MCP registration, and browser capability verified, so that a partial setup
   is not reported as ready.
7. As a tabletop creator, I want transient installation or OAuth failures
   retried safely, so that one timeout does not abandon setup.
8. As a tabletop creator, I want repeated failures to produce a recovery task
   containing the exact failed step, so that recovery starts with evidence.
9. As a tabletop creator, I want successful setup to create and open a fresh
   GoDesk task automatically, so that I do not have to understand session
   reload rules.
10. As a tabletop creator, I want the new task to contain a useful starter
    prompt, so that it can immediately create or open my first Game Project.
11. As a tabletop creator, I want to create a Game Project from a brief, source
    bundle, or empty starting point, so that GoDesk supports both generative and
    hands-on workflows.
12. As a tabletop creator, I want the Web Editor surfaced immediately after
    project creation, so that I can see and manually adjust the real work.
13. As a tabletop creator, I want to list and target only Game Projects I can
    access, so that Codex never guesses a project or crosses account boundaries.
14. As a tabletop creator, I want a Game Project to keep its Source Library,
    Game Definitions, Playable Builds, playtests, and rooms together, so that
    the work has one durable home.
15. As a tabletop creator, I want rulebooks, briefs, images, and generated
    assets retained as Source Library entries with provenance, so that generated
    rules and components remain traceable.
16. As a tabletop creator, I want one project to hold multiple editable Game
    Definitions, so that variants can share sources without overwriting each
    other.
17. As a tabletop creator, I want to duplicate a Game Definition before a risky
    change, so that experimentation is reversible.
18. As a tabletop creator, I want every accepted project mutation to produce a
    changeset and new project version, so that I can understand what changed.
19. As a tabletop creator, I want Codex mutations to require the version it
    read, so that my manual editor changes cannot be silently overwritten.
20. As a tabletop creator, I want version conflicts to return current state and
    affected entities, so that Codex can refresh and propose a safe retry.
21. As a tabletop creator, I want destructive actions to require explicit
    targets and confirmation, so that session defaults cannot delete the wrong
    project or definition.
22. As a tabletop creator, I want project reads to be staged and bounded, so
    that Codex inspects only the rules, components, board, scenario, build, or
    playtest data needed for the task.
23. As a tabletop creator, I want to turn a brief and sources into an editable
    Game Definition, so that AI output remains a project I can revise rather
    than a flattened artifact.
24. As a tabletop creator, I want AI-proposed facts to retain source anchors
    and confidence internally, so that uncertainty is reviewable.
25. As a tabletop creator, I want GoDesk to ask only high-impact
    clarifications, so that routine generation remains fast.
26. As a tabletop creator, I want unsupported rules and missing capabilities
    shown explicitly, so that a partial build is not presented as a complete
    game.
27. As a tabletop creator, I want deterministic compilation from a versioned
    Game Definition, so that the same definition produces the same rule-bearing
    build.
28. As a tabletop creator, I want a Playable Build to be immutable, so that
    rooms, playtests, and replays keep a stable rules baseline.
29. As a tabletop creator, I want long generation, compilation, rendering, and
    export work submitted as durable jobs, so that Codex can track progress
    without holding one tool call open.
30. As a tabletop creator, I want job retries to be idempotent, so that network
    recovery does not duplicate builds or assets.
31. As a tabletop creator, I want a playable preview opened from the editor, so
    that I can test the current build without leaving the project context.
32. As a tabletop creator, I want deterministic bot playtests with recorded
    seeds, metrics, and representative replays, so that balance findings can be
    reproduced.
33. As a tabletop creator, I want bot results clearly separated from human
    playtest evidence, so that simulation is not misreported as user validation.
34. As a tabletop creator, I want to create an authoritative room from one
    immutable build, so that all players share the same rules and state.
35. As a player, I want my client to send intents rather than replace Table
    State, so that invalid actions cannot become authoritative.
36. As a player, I want accepted actions persisted in order, so that reconnect,
    reconstruction, and replay are deterministic.
37. As a creator, I want Playable Build and room links returned as exact GoDesk
    URLs, so that Codex never guesses an environment or route.
38. As a creator, I want structural readback after a Codex mutation, so that
    tool success is verified against actual project state.
39. As a creator, I want a structured visual preview inspected before visual
    claims are made, so that missing zones, actions, and unsupported behavior
    are visible in the MVP. Pixel-accurate screenshot rendering is a later
    capability and must not be implied by this preview.
40. As a creator, I want compile, runtime, render, and editor-visible evidence
    combined before work is reported complete, so that one passing layer does
    not mask another failure.
41. As a creator, I want the editor to show the current project version and
    changeset, so that browser and Codex collaboration is understandable.
42. As a creator, I want installation and creation workflows documented as
    Skills rather than hidden agent behavior, so that workflows are repeatable
    and updatable.
43. As a creator, I want the MCP tools usable without custom widgets, so that
    core work remains available in headless hosts.
44. As a creator, I want compact widgets only for bounded selection, diffs, and
    confirmation, so that the full editor remains the high-fidelity work
    surface.
45. As a maintainer, I want active MCP schemas to be the runtime contract, so
    that stale Skill prose cannot override deployed tool behavior.
46. As a maintainer, I want installation acceptance bound to actual Codex host
    capabilities and versions, so that one CLI command sequence is not promised
    universally.
47. As a maintainer, I want the old player-first default route and ADR formally
    superseded, so that two conflicting product directions do not coexist.
48. As a maintainer, I want useful existing ingestion, provenance, domain,
    deterministic action, and Manila fixture code retained behind the new
    model, so that the refactor preserves verified work.
49. As a maintainer, I want superseded authoring experiments and misleading
    player-first shells removed from normal navigation, so that the product has
    one canonical route.
50. As a maintainer, I want the Manila source licensing boundary remain
    visible, so that internal evidence is never published as cleared content.

## Implementation Decisions

- The primary product actor is the tabletop creator or producer. A player
  consumes a Playable Build through a room; they do not operate the creation
  pipeline.
- The canonical product model is `Game Project -> Source Library + Game
  Definitions -> Playable Builds`.
- A Game Project is the access-control and versioning aggregate. It owns a
  Source Library, one or more editable Game Definitions, project changesets,
  build jobs, Playable Builds, playtests, and room references.
- A Source Library entry stores content metadata, readiness, provenance, and
  stable identity. Rule-bearing generated objects retain source anchors.
- A Game Definition is the editable source of truth for rules, components,
  setup, actions, phases, scenarios, presentation configuration, and supported
  runtime behavior.
- A Playable Build is an immutable compilation of one Game Definition version.
  A room or automated playtest always references one exact build.
- GoDesk service state is authoritative. Browser clients and Codex submit
  intents or controlled mutations; neither may replace stored authoritative
  state directly.
- Every project mutation requires an expected project version and idempotency
  key, produces an atomic changeset, and returns previous version, new version,
  affected entities, warnings, and exact editor handoff data.
- A stale expected version returns a structured conflict without applying any
  operations. Codex must refresh the relevant project view before proposing a
  retry.
- Project reads are progressive: orientation, definitions, sources, rules,
  components, board, scenarios, builds, playtests, rooms, and individual entity
  detail are requested explicitly and support pagination.
- Long-running generation, compilation, bot playtest, render, and export
  operations use `submit -> jobId -> track` with durable terminal results.
- AI may propose briefs, content, candidate rules, components, layouts, art
  prompts, and diagnoses. Deterministic services validate and persist accepted
  mutations, compile Game Definitions, execute authoritative rules, generate
  seeds, and reconstruct replays.
- The initial remote MCP surface is goal-oriented rather than a mirror of
  internal APIs. It covers project discovery and targeting, project creation,
  exact editor handoff, bounded project reads, source import, atomic game
  patches, compilation, bot playtests, rendered previews, build/room creation,
  job tracking, duplication, and explicit destructive operations.
- MCP tool results declare exact structured output, remain useful without UI,
  and annotate read-only, destructive, idempotent, and open-world behavior where
  supported.
- MCP App widgets are progressive enhancement for project selection, changeset
  review, conflicts, and confirmation. They are never required to edit or play
  a game.
- The GoDesk Plugin is thin. It packages the manifest, remote MCP
  configuration, brand assets, and workflow Skills; business logic and project
  state remain in GoDesk services.
- The installation guide is hosted by GoDesk and is written as an execution
  contract for Codex. It performs a desktop-host gate, locates the bundled CLI,
  installs the marketplace/plugin, completes GoDesk OAuth, verifies plugin,
  MCP, and browser capabilities, and creates and opens a new task with a
  localized starter prompt.
- Installation success is a state, not a command exit: plugin installed and
  enabled, OAuth complete, MCP server discoverable, required browser control
  available, and the new task containing the starter prompt.
- Web or isolated hosts stop before local installation and provide the exact
  desktop prompt. Repeated failures create a recovery task containing the exact
  failed step. A recovery task is not reported as successful installation.
- The Web Editor opens early and uses the same authenticated Game Project as
  MCP. It exposes sources, Game Definition structure, project version,
  changesets, compile warnings, jobs, previews, playtests, builds, and room
  handoffs without exposing raw database models.
- The visible editor is a collaboration surface, not merely test evidence.
  Manual edits and Codex edits share optimistic version semantics.
- The deterministic runtime accepts client intents, validates them against the
  immutable build, persists accepted actions, reconstructs Table State, and
  provides replay without allowing replay to mutate live state.
- The existing Manila fixture remains internal-only acceptance evidence.
  Existing ingestion, provenance, game-domain, and deterministic-action logic
  should be adapted where it satisfies the new contracts. Superseded
  player-first routes and authoring experiments do not remain in canonical
  navigation.
- ADR 0001 is superseded by a creator-platform ADR. The domain glossary is
  updated so Creator, Game Project, Source Library, Game Definition, Playable
  Build, Build Job, Playtest, Room, Changeset, Intent, Accepted Action, Action
  Log, and Table State are canonical terms.
- Implementation proceeds as vertical tracer bullets: local authoritative
  project loop; remote MCP and editor loop; compile/playtest/runtime loop;
  installation/OAuth/new-task loop; deployment and external acceptance.

## Testing Decisions

- The primary acceptance seam is one fresh Codex Desktop task: the user issues
  one installation sentence; the agent completes host gating, installation,
  GoDesk OAuth, verification, and new-task handoff; the new task creates a Game
  Project, opens the Web Editor, applies one version-checked mutation, compiles
  an immutable Playable Build, renders and inspects a preview, runs a
  deterministic playtest, and returns visible project evidence.
- A failure at any installation stage must prove the recovery path with the
  exact failed step. Unsupported hosts must prove the desktop handoff and must
  not claim installation.
- Service contract tests exercise project access, staged reads, source
  provenance, atomic changesets, expected-version conflicts, idempotency,
  durable jobs, immutable builds, authoritative intents, accepted actions, and
  deterministic replay.
- MCP contract tests use the public tool schemas and structured results rather
  than internal service calls. They verify exact editor URLs, explicit
  destructive targets, per-call project targeting, result annotations, and a
  headless path for every core operation.
- Editor integration tests start at the creator-visible project route and verify
  that MCP-side changes appear, manual changes increment the same version,
  conflicts are visible, builds and playtests are reachable, and unsupported
  capability boundaries remain explicit.
- Runtime tests operate through client intents at the highest available room
  seam. They verify rejection of invalid intents, persistence of accepted
  actions, deterministic reconstruction, reconnect, and replay isolation.
- Visual verification renders representative board zones, action cards, and
  score-track structure in the visible Playable Build route and inspects the
  resulting browser pixels. The MVP does not produce a screenshot artifact or
  claim pixel-accurate art/layout rendering.
- Bot playtest tests use fixed seeds and compare reproducible metrics and replay
  identifiers. They must not satisfy human-playtest acceptance.
- Existing domain, ingestion, authoring, playable, typecheck, and production
  build tests remain useful prior art. They are retained only where their
  external behavior still matches the new product.
- Every implementation increment runs focused tests first, then the repository
  test suite, typecheck, production build, and `git diff --check`.
- Final acceptance is performed by an independent subagent that did not author
  the implementation. It must identify each required feature's user-visible
  location, the exact route or command used to reach it, the observed behavior,
  and any gap between automated, deployed, and human evidence.

## Out of Scope

- Claiming arbitrary uploaded games are fully understood before a second-game
  transfer test proves the Game Definition model.
- Treating the Manila fixture as commercially publishable, licensed for
  redistribution, or rules-complete.
- Using Codex or an LLM as the authoritative rules engine.
- Making MCP App widgets a replacement for the Web Editor.
- Billing, paid plans, organization collaboration, and marketplace ranking.
- Production-scale provider selection before the generation and job interfaces
  are proven.
- Claiming public marketplace approval, live OAuth, or production deployment
  without external provider evidence.

## Further Notes

- The ChatCut reference is a product pattern, not a schema to copy. Its
  timeline-specific tools, storage paths, and editor internals are not GoDesk
  requirements.
- The active MCP manifest outranks Skill prose when tool names or schemas drift.
- The current local Codex CLI observed during research does not expose all
  commands documented by the current plugin manual. Installation code and
  acceptance must locate and test the actual Codex Desktop bundled CLI.
- This spec intentionally replaces the unresolved Wayfinder questions with the
  ChatCut-aligned defaults confirmed by the product owner. The Wayfinder map
  remains an evidence index, while this specification becomes the
  implementation contract.
