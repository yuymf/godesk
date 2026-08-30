# Domain Docs

How the engineering skills should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- **`AGENTS.md`** — product charter and Playwright verification rule.
- **`CONTEXT.md`** at the repository root.
- **`docs/adr/0011-chatcut-playable-output-is-the-product.md`** — current product identity.
- **`docs/adr/`** — other ADRs that touch the area about to be changed.

If any of these files do not exist, proceed silently. The `/domain-modeling` skill creates them lazily when terms or decisions are actually resolved.

## File structure

This repository uses a single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether the project uses it or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If work contradicts an existing ADR, surface it explicitly rather than silently overriding it.
