# Glossary

Shared vocabulary for GoDesk. Prefer these terms in docs, UI, and Skills.

| Term | Meaning |
|:---|:---|
| **Creator** | Person who supplies an idea, script, or rules and wants a playable, shareable game |
| **Participant** | Person who joins a Shared Session via invitation URL (no Codex install) |
| **Rule System** | Editable model of participants, entities, setup, actions, stages, outcomes, presentation |
| **Game Project** | Versioned home for sources, Rule Systems, Builds, and Shared Sessions |
| **Source Library** | Traceable briefs, rules docs, images, and generated assets for a project |
| **Visual Reference** | Image that guides style; not placed into the Rule System itself |
| **Project Asset** | Image that can be placed on an entity, surface, or presentation |
| **Game Entity** | Named thing governed by the Rule System (card, token, character, …) |
| **Play Surface** | Presentation / interaction arrangement (table, cards, conversation, screen, …) |
| **Executable Kernel** | Deterministic rules implementation selected by a Rule System |
| **Playable Build** | Immutable executable output compiled from one Rule System version |
| **Shared Session** | Authoritative run of one Build that Participants join by URL |
| **Playtest Link** | Stable project URL that resolves to one published Shared Session |
| **Accepted Action** | Validated Intent persisted in sequence by the Executable Kernel |
| **Replay** | Read-only reconstruction of a Shared Session |
| **Web Studio** | Browser collaboration surface for the same Game Project Codex edits via MCP |

Optional iteration tools (not the product): Design Hypothesis, Experiment Brief, Feedback Moment, Validation Finding.

Success bar: `source in → playable finished game out → others can play together`.
Share gate: Playability Floor ([ADR 0012](./adr/0012-playability-floor-is-the-share-gate.md)).
