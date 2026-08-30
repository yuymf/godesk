# ADR 0004: Shareable prototype is the product low bar

Status: superseded as product identity by ADR 0005; restored and raised by ADR 0011

Date: 2026-08-04

## Context

ADR 0002 and ADR 0003 adopted ChatCut's dual surface (website workspace + agent
plugin) and a rulebook-first onboarding path. In practice the default journey
stopped at a dense Web Editor and schema-like builds, so a stranger could not
reliably reach "play with friends." The product owner restated the only low
bar that matters.

## Decision

The product low bar is:

```text
write or upload a board-game rulebook
  -> GoDesk generates a playable game prototype
  -> that prototype can be shared so others can play it
```

Every surface and intermediate control must serve this outcome:

- **Website form** (ChatCut-style browser app): the stranger acceptance path for
  upload → generate → share/play.
- **Plugin form** (ChatCut-style Codex/agent install): the same Game Project
  controlled in natural language, without requiring the user to operate the
  full authoring pipeline by hand.

Authoritative contracts from ADR 0002 remain (versioned projects, immutable
builds, deterministic rooms/replay, MCP edits). The Web Editor stays an
authoritative collaboration surface for professionals and for Codex-visible
verification, but it is not the success criterion. Landing in a complex editor
without a shareable playable prototype is a failed journey.

Honest partial executability is allowed only when unsupported behavior is
visible and the shareable surface is still a real table session, not a
definition viewer.

## Grill decisions (2026-08-04)

1. **Post-generation landing:** open the playable table with a share entry
   directly. Do not require the dense Web Editor as the success screen.
2. **Share form:** one invitation link that lets another person join a Room and
   play (login may be required initially).
3. **Playable honesty:** a disclosed subset of rules may execute, but the shared
   surface must still be a turn-taking table, not a definition viewer.
4. **Assets (revised):** assets are part of the prototype path, not a deferred
   sidebar. Prefer, in order: extract usable images from the rulebook; reuse or
   curate entries in the Source Library / asset library; generate missing
   visuals through dedicated Skills that can call generative APIs.
5. **Generative capacity (dual channel):** Plugin/Codex mode spends the host
   user's own agent/image quota. Website mode will later sell a subscription
   that includes GoDesk-provided agent/image capacity — record the intent now,
   do not implement billing in the current low-bar slice.
6. **Share gate:** do not publish a share link for a visually crude table.
   Sharing waits until the prototype has a presentable visual floor. Pure text
   boards and naked placeholders are not an acceptable shared product.
7. **Visual floor / backup:** when generative APIs are unavailable (no key, no
   quota, website subscription not yet live), assemble a non-ugly baseline in
   this order: (A) extract/crop art from the rulebook, then (C) programmatic /
   typographic rendering of cards and board regions, then (B) a designed
   theme fallback kit. Optional user uploads may enrich the floor but must not
   block the main path. Pure text boards and naked placeholders are never the
   shared product.
8. **Inputs:** a rulebook alone (paste / PDF / md / txt) is enough; an
   experience description is optional.
9. **Surfaces:** the website proves upload → shareable prototype first; the
   plugin must operate the same Game Project, but does not block website
   acceptance.
10. **Web Editor:** secondary power-user / Codex verification surface; the
    default journey does not route through a dense multi-panel editor.
11. **Acceptance content:** Manila remains internal engineering evidence; any
    public default example must be rights-cleared and separately published.

## Consequences

- Scope is judged by "rulebook in → shareable prototype out," not by editor
  panel completeness, ChatCut visual parity, or rules-complete Manila fidelity.
- Asset extraction and generation Skills are first-class product work for the
  low bar. Expect multiple Skills (or Skill steps) for: rulebook image
  harvest, asset-library attach/replace, generative fill-in with provenance,
  and binding assets into the Playable Build / Room presentation.
- Website subscription billing is intentional future work; Plugin/Codex MVP
  uses the host user's quota. Do not block the low-bar path on billing.
- A share invitation is gated on meeting the Visual Floor; crude
  text/placeholder-only tables must not be the shared product.
- Work that does not shorten the shareable-prototype path is deferrable
  power-user or engineering surface.
- ADR 0003's one-action generation remains, but its required final step becomes
  "open a shareable playable prototype," with Editor access secondary.
- ADR 0001's player outcome is restored as the success metric without revoking
  ADR 0002's Codex/plugin control plane.
