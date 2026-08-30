# Preserve source actions at the Executable Kernel boundary

Type: task
Status: resolved

## Question

Can prompt-first generation preserve every extracted action instead of silently
dropping actions before deciding whether a supported Kernel is safe to configure?

## Answer

Yes. The materializer no longer truncates candidate actions to six, and the
generation job no longer truncates runtime candidates before comparing them
with the editable Rule System. Up to the existing Kernel limit of twelve
actions are preserved and can be configured. More than twelve actions remain
an editable `draft` Rule System with an explicit warning, so the source is not
silently reduced into a different executable game.

Regression coverage now proves that twelve English scored actions survive
materialization and that thirteen actions retain action 13 while refusing
automatic Kernel configuration. The current HTTP and MCP self-play loops also
pass after this change.

## Comments

- 2026-08-10: Fixed `worker/rulebook-generation.ts` and the generation-job
  runtime guard; Worker suite is 4 files and 76 tests.
