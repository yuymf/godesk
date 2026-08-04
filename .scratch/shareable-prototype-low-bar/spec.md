# Rulebook → Shareable Prototype

Status: ready-for-agent

Source decisions: ADR 0004, CONTEXT.md (Shareable Prototype, Visual Floor, Source Library, Generated Asset)

## Problem Statement

A person can write or upload a board-game rulebook and expects GoDesk to produce a
prototype that friends will actually want to open and play. Today the default
journey lands in a dense Web Editor, the playable surface is mostly text
zones, assets are not harvested or generated, and there is no real invitation
experience. The product feels like an authoring console, not "rulebook in →
shareable game out."

## Solution

Keep ChatCut's dual surface (website + agent plugin), but make the success
criterion a Shareable Prototype: after one rulebook-driven generation run, the
user lands on a presentable table with a single invitation link. The Web
Editor remains available for professionals and Codex verification, but is
secondary. Visuals meet a Visual Floor before sharing is allowed, using
rulebook extraction first, then typographic/programmatic rendering, then a
theme fallback kit, and generative APIs when capacity exists (Codex user quota
now; website subscription later).

## User Stories

1. As a player, I want to paste or upload only a rulebook and start one
   generation run, so that I do not need an experience brief or authoring
   jargon to begin.
2. As a player, I want the website journey to finish on a playable table with
   share controls, so that I can invite friends without opening the Web
   Editor.
3. As a player, I want an invitation link I can copy and send, so that a
   friend can join the same Room and play.
4. As a joining friend, I want to open that link and take a seat at the table,
   so that we are not stuck in single-browser hot-seat only.
5. As a player, I want unsupported rules disclosed on the table, so that I
   know what is real versus approximate without reading a definition dump.
6. As a player, I want rulebook images harvested into the Source Library and
   bound to components/zones when present, so that the table looks like the
   game I uploaded.
7. As a player, I want missing art filled by generative Skills when my Codex
   quota or future website subscription allows it, so that cards and boards
   look intentional.
8. As a player without generative capacity, I want a designed Visual Floor
   (extracted art → typographic cards/board → theme kit), so that sharing is
   never a naked text/placeholder table.
9. As a player, I want sharing blocked until the Visual Floor is met, so that
   I do not send friends an ugly prototype.
10. As a player, I want generation progress to show completed, pending, and
    unavailable asset/rule capabilities honestly, so that I trust the product.
11. As a Codex user, I want Plugin Skills that create the same Shareable
    Prototype using my agent/image quota, so that I can drive the flow in
    natural language without operating the full editor pipeline.
12. As a Codex user, I want Skills for harvesting rulebook images, attaching
    Source Library assets, requesting generative fill-in, and binding visuals
    into the Playable Build, so that assets are first-class agent work.
13. As a professional, I want optional access to the Web Editor for the same
    Game Project, so that I can manually adjust Definition and presentation
    when needed.
14. As a professional, I want Codex edits and Web Editor edits to share the
    same versioned Game Project contracts, so that neither surface forks the
    truth.
15. As a player, I want an immutable Playable Build behind every shared Room,
    so that friends always play the same baseline.
16. As a player, I want Room intents to be authoritative and replayable, so
    that disputes and debugging have a single Action Log.
17. As a player, I want bot playtests labeled separately from human play, so
    that I do not confuse automated evidence with a real session.
18. As a player, I want default public examples to be rights-cleared, so that
    Manila-derived material is never shipped as the public default.
19. As a player, I want optional experience text to steer tone without being
    required, so that a rulebook alone remains sufficient.
20. As a future website subscriber, I want GoDesk-provided agent/image
    capacity on a plan, so that I am not dependent on a personal Codex key
    (billing itself is out of scope for this slice).
21. As a player, I want replaceable Generated Assets with provenance labels
    (extracted / uploaded / generative), so that I can swap bad art without
    rewriting rules.
22. As a player, I want the Room presentation to use bound assets rather than
    hard-coded Manila paths, so that a second rulebook can reach the same
    journey.
23. As a developer, I want Visual Floor checks expressed against Build/Room
    readiness, so that share gating is testable without UI archaeology.
24. As a player on mobile, I want the upload → ready → room → invite path to
    remain usable on a narrow screen, so that I can share from a phone.

## Implementation Decisions

- Product success is gated by ADR 0004: rulebook in → Shareable Prototype out.
  The website is the stranger acceptance path; the Plugin operates the same
  Game Project.
- Reuse the existing Home pipeline (create project → `generate-definition` →
  `compile-build`) and change its ready destination: primary CTA creates a
  Room and opens `/room/:roomId` with invitation affordances; Editor and raw
  Build preview are secondary.
- Experience description becomes optional in the Home UI and generation job
  inputs; rulebook text alone must submit.
- Extend Source Library usage so `kind: "image"` is a real write path.
  Prefer reusing client PDF page rendering already present in ingestion, then
  persist harvested images as Source Library entries with provenance.
- Add durable job kinds (or Skill-orchestrated sequences) for: harvest
  rulebook images, assemble Visual Floor presentation, optional generative
  fill-in. Generative calls in Plugin/Codex mode consume host-user capacity;
  website-provided capacity is future subscription work only.
- Visual Floor priority when generation is unavailable: extract/crop from
  rulebook → programmatic/typographic card and board rendering → designed
  theme fallback kit. Optional uploads enrich but do not block.
- Share gate: `createRoom` / invitation UI refuses until the Playable Build
  meets Visual Floor criteria (presentable bound visuals for primary
  components/zones, or an applied fallback kit; never text-only/naked
  placeholder tables).
- Multiplayer invitation: expose a single Room URL as the invitation link;
  extend Room join so a second browser can claim a seat (minimum: select or
  be assigned a seat and submit intents for that seat). Full social graph and
  guest-anonymous productization can stay thin, but two-browser play must work.
- Keep authoritative boundaries from ADR 0002: versioned Changesets,
  immutable Builds, deterministic runtime, replay. LLM/agent output may
  propose assets and Definition patches; it never becomes the rules engine.
- Retain honest partial execution (`unsupportedBehavior` visible on Build and
  Room). Do not claim rules-complete Manila or arbitrary prose fidelity.
- Plugin Skills to add/adjust: create/shareable-prototype skill path that ends
  on Room + invite URL; asset harvest skill; generative fill skill; bind/
  replace asset skill. Existing create/edit/playtest/export skills stay but
  must not force Editor-first success language.
- Web Editor is not removed; it is demoted in copy and default navigation.
- Public default examples must remain rights-safe; Manila stays internal
  evidence.

## Testing Decisions

Good tests assert external behavior at durable boundaries: HTTP/MCP contracts,
job terminal results, Build/Room readiness, Visual Floor allow/deny, and
two-browser seat play. Do not assert React panel layout details or internal
heuristic regexes except where they are the published materialization contract.

Primary seams (reuse, do not invent parallel stacks):

1. **Project job + Build seam** — `generate-definition` / `compile-build` via
   Worker project API (existing `worker/projects.test.ts` patterns). Assert
   optional experience text, Source Library rulebook entry, and Playable Build
   with disclosure fields.
2. **Asset / Visual Floor seam** — harvest and floor assembly produce Source
   Library image entries and a Build presentation that either passes the share
   gate or fails with an explicit reason. Prefer extending Worker/project tests
   and ingestion tests over UI-only checks.
3. **Room invitation seam** — `createRoom` blocked when Visual Floor unmet;
   allowed when met; returned `roomUrl` is the invitation; a second client can
   join/claim a seat and submit an intent that advances Table State. Extend
   existing room/intent coverage in `worker/projects.test.ts` and runtime
   tests.
4. **Plugin/MCP seam** — Skills/tools can drive harvest → floor → compile →
   create room and return the invitation URL without requiring Editor
   navigation. Reuse MCP schema publication tests in `worker/mcp.ts` /
   projects tests.

Prior art: `worker/projects.test.ts`, `worker/rulebook-generation.test.ts`,
`worker/runtime.test.ts`, `src/platform/ingestion.test.ts`, ChatCut-platform
acceptance ledger evidence boundaries.

Confirm these four seams before implementing tickets. If a fifth seam is
needed, prefer extending Build readiness rather than adding a new service.

## Out of Scope

- Website subscription billing, plans, and GoDesk-hosted image credit metering
  (intent recorded only).
- Rules-complete implementation of arbitrary uploaded games or full Manila
  fidelity as the default kernel.
- Replacing `score-race-v1` / `harbor-voyage-v1` with a universal rules engine
  in this slice.
- Dense Editor redesign as a primary deliverable (only demotion + whatever
  minimal wiring share/play needs).
- Social features beyond Room invitation and seat join (friends lists, chat,
  matchmaking).
- Publishing third-party rulebooks as public marketplace content.
- Claiming human playtest completion without a real multi-human session
  record.

## Further Notes

- ChatCut form reference: browser app and agent plugin share one project;
  GoDesk mirrors that split without copying ChatCut brand assets.
- Acceptance stranger story: upload/paste a rights-safe rulebook on the
  website → wait for generation and Visual Floor → land on Room → copy invite
  → second browser joins and both can play the executable subset.
- Plugin stranger story (Codex): install plugin → natural language create from
  rulebook → Skills harvest/fill assets using user quota when available →
  receive invitation URL for the same project/build.
- Related prior maps (do not fork blindly): 
  `.scratch/player-to-playable-platform/`,
  `.scratch/godesk-chatcut-platform/`. This spec supersedes their success
  criterion with ADR 0004 while reusing their durable contracts.
