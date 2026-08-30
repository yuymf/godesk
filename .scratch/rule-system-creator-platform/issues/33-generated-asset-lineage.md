# Trace a generated asset back to its creator brief

Type: task
Status: resolved

## Question

Can a creator describe a visual in natural language, let Codex generate it,
bind it into the editable Rule System, and later prove which description
produced the image?

## Answer

Yes. The creator's visual direction is stored as a `brief` Source Library
entry. A generated image must use `generative-api` provenance, be a
`project-asset`, and persist `basedOnSourceIds` pointing to that existing
same-project brief and every Visual Reference used. Missing dependencies fail
closed with `source_dependency_not_found`.

The generated image remains ordinary replaceable presentation data. Binding it
changes the current Rule System; compilation snapshots the image and the full
source dependency closure into a new immutable Build. Studio shows the image,
its provenance, and the exact brief name and Source ID. It does not infer the
relationship from names, timestamps, or locator text.

This follows the useful part of Tesana's current pattern: reference images can
steer palette, mood, style, and detail, while custom assets are attached to a
prompt and the agent wires them into the project. GoDesk adds an explicit
machine-readable source chain for generated presentation material. References:
<https://docs.tesana.ai/building/image-references> and
<https://docs.tesana.ai/building/custom-assets>.

Browser acceptance used Project
`project_973d28a1-e98c-40b6-9801-4f7b373670ac`. Visual brief
`source_acceptance_visual_brief` motivated generated image
`source_acceptance_generated_card`. Build
`build_448a8550935bc549e1277384` retained both Source IDs and passed its
Presentation Floor. Seed 42 bot simulation finished in 5 turns with Replay
`replay_953db0bf-598c-4547-b98c-005c0670aef9`.

Shared Session `room_08f424b2-0ce3-4043-8264-b455fd48eb89` used the same
Build. Browser self-play claimed seat 0 and submitted `调查线索`; authoritative
state advanced from turn 0 / progress 0 to turn 1 / progress 2, and Replay
`replay_f0924083-97f2-4738-a473-35cf7f8bcd16` recorded the action. This is
local automated and agent-operated evidence, not a real-person playtest.

A fresh regression acceptance after fixing concise Chinese materialization used
Project `project_8f323efd-2922-47cb-a5de-936d1b90e638`, visual brief
`source_acceptance_direct_visual_brief`, generated image
`source_acceptance_direct_generated_card`, and Build
`build_3000fd76ae6d6d525b9c933e`. The Build retained both Source IDs, passed its
Presentation Floor, and showed the generated image in the browser preview.
This second run did not manually configure the runtime before compilation.

## Comments

- 2026-08-11: Added generated-source dependency validation, transitive Build
  source capture, MCP schema and verifier coverage, Studio source previews,
  Skill workflow, an actual host-generated image, and browser self-play.
- 2026-08-11: Repeated the browser path on the exact concise creator prompt
  after parser repair; generation, asset binding, Build, bot Playtest, and Room
  all completed without a manual runtime patch.
