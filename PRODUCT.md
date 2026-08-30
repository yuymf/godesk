# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are amateur hobbyists of board games, script-kill (剧本杀), and
card games. They arrive with a written idea, a script, a rulebook, or optional
pictures. They are not professional game designers and do not want to operate a
validation cockpit.

A secondary user is a friend who receives an invitation URL and plays in the
browser. They do not install Codex or GoDesk.

## Product Purpose

GoDesk is a ChatCut-style rule-game generator. A Creator supplies a script,
rulebook, written idea, or optional visuals and receives a playable, shareable
game. Other people join a Shared Session through a URL and play together.

Success is `source in → playable game out → others can play together`.

## Positioning

ChatCut: install a Plugin, upload a video, receive a finished film. GoDesk is
the same shape for rule-orchestrated games. The destination is a joinable game,
not a Finding, not an authoring pipeline.

## Operating Context

Creators start on the website composer or through Codex Skills. Web Studio and
Codex operate the same Game Project. Friends only need the invitation URL.

## Capabilities and Constraints

- A prompt alone is a valid start. PDF, Markdown, text, and images are optional.
- Generation Plan review and unsupported-behavior honesty remain implementation
  contracts. They must not replace the shareable game as the outcome.
- Design Hypotheses and Validation Findings are optional iteration tools.
- Tabletop is one Play Surface, not the product boundary.
- Inferred from the user brief and ADR 0011 / CONTEXT.md; not a new interview.

## Brand Commitments

- Name: GoDesk
- Binding interaction reference: ChatCut (prompt-first workspace, playable
  output as the product)
- Audience named by the user: amateur 桌游 / 剧本杀 / 棋牌 hobbyists
- Domain vocabulary in CONTEXT.md remains the internal contract. Visible UI
  should speak in the hobbyist's words first.

## Evidence on Hand

Rights-safe default examples: `港口十三号`, `雾岭山庄`, `灵感接力`. Do not
invent third-party rulebooks, licensed script-kill IP, or customer claims.

## Product Principles

1. The first valuable moment is a playable, shareable game.
2. One obvious next action. Hide authoring, evidence, and system facts until
   needed.
3. Speak like a hobbyist. Keep Rule System / Finding language off the default
   path.
4. Honesty over invention: unsupported behavior stays visible.
5. Friends join by URL only.

## Accessibility & Inclusion

WCAG AA contrast for body and controls. Keyboard-reachable primary actions.
Honor `prefers-reduced-motion`.
