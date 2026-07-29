# Godesk ChatCut-style refactor map

Status: handed-to-spec

## Destination

Produce an implementation-ready refactor specification that replaces Godesk's
player-first upload flow with a ChatCut-style creator platform: Codex is the
control plane, the Godesk Web Editor is the visible editable work surface, a
remote MCP server exposes controlled operations over an authoritative backend,
and deterministic playable builds and rooms remain separate from AI decisions.

The creator can begin with one natural-language installation request that
points Codex at a GoDesk-hosted installation guide. In a supported desktop host,
Codex completes host detection, plugin installation, GoDesk OAuth,
verification, and a handoff into a fresh GoDesk creation task. From there,
project creation, editing, generation, verification, playtesting, and delivery
follow the same Codex-control-plane plus visible-editor pattern.

The specification is ready when an implementation team can execute the
refactor in staged increments without making unresolved product, domain,
authority, migration, or acceptance decisions.

## Notes

- The primary user is now the tabletop creator or producer. Players consume
  playable builds and rooms; they do not operate the creation pipeline.
- Use ChatCut 0.2.20's installed plugin, active MCP schemas, and official Codex
  documentation as the reference implementation, not a loose analogy.
- Treat `https://chatcut.io/chatgpt-plugin` as the reference installation
  journey: one natural-language request drives a host-gated install, OAuth,
  verification, and automatic handoff into a newly created task. GoDesk must
  publish and own its analogous guide and authentication surfaces.
- Canonical mapping agreed while naming the destination:
  `Game Project -> Source Library + Game Definitions -> Playable Builds`.
- The backend is the intended system of record. Codex proposes controlled
  operations through MCP; it does not write databases or become the game rules
  runtime.
- Preserve the existing hard trust boundary: clients send intents,
  authoritative services accept actions, and replay is reconstructed from
  persisted accepted actions.
- Every session working this map should consult `/wayfinder`,
  `/domain-modeling`, and `/grilling`; use `/prototype` for prototype tickets
  and `/research` for research tickets.
- Planning is the destination of this map. Product implementation, deployment,
  marketplace submission, and production data migration begin only after the
  map is resolved.

## Decisions so far

<!-- Closed ticket decisions are indexed here; detail lives in the ticket. -->

- [Verify the current ChatCut and Codex platform contract](issues/01-verify-chatcut-codex-platform-contract.md) — Adopt ChatCut's thin-plugin, authoritative-backend, exact-editor-handoff, refresh-before-edit, dual-verification, and durable-job patterns while treating MCP Apps as optional and installation as host/version-specific.
- [GoDesk ChatCut-style creator platform specification](spec.md) — The product
  owner confirmed the one-sentence installation-to-editor acceptance seam and
  directed the remaining map questions to be synthesized with ChatCut-aligned
  defaults rather than continued interview.

## Not yet specified

- The exact AI generation and rule-compilation provider mix can only be
  specified after the authoritative service and job boundaries are decided.
- The useful shape of in-Codex MCP App widgets depends on which review
  interactions belong in Codex versus the Web Editor.
- Operational scale, usage limits, billing, and creator collaboration policy
  depend on the first project lifecycle and identity decisions.
- Public marketplace review details beyond the one-sentence installation
  acceptance can be planned after the initial distribution and authentication
  contract is fixed.

## Out of scope

- Implementing the refactor during the Wayfinder effort.
- Claiming the current Manila fixture is a commercially publishable or
  rules-complete game.
- Selecting production AI vendors before the provider boundary is defined.
- Deploying the product backend, charging users, or migrating production data.
- Completing public marketplace review; the package and installation contract
  needed to make submission possible remain in scope.
