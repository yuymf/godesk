# Manila guided-authoring stranger test protocol

Status: ready-for-human

## Purpose

Test whether an unfamiliar tabletop designer can independently complete the
seeded source-to-playable exercise without being told what to click.

Automation may verify the fixture and controls, but it cannot count as a
participant session.

## Participants

- Recruit at least three people who have not seen this prototype.
- Prefer people who understand tabletop games but do not need development or AI
  tooling experience.
- Record relevant prior experience without excluding novices.

## Consent

Before opening the product, ask permission to record screen, audio, timestamps,
and observational notes. If recording is declined, use timestamped written
notes and do not capture personal identifiers.

## Fresh-session setup

1. Start the current verified local build.
2. Open `/` without `variant`, `view`, or `devVariants` query parameters.
3. Reload so the seeded state starts clean.
4. Confirm the page title is `Godesk Forge · AI 原生桌游创作验证台`.
5. Do not show the A/B/C development routes.
6. Prepare a copy of `usability-session-template.md`.

## Starting scenario read to the participant

> 你正在把一款桌游的规则书和实物照片整理成内部试玩版本。系统已经做了一轮
> AI 提取，但 AI 的结果还不是规则。请从第一页开始，把项目推进到可玩成品，
> 然后告诉我这个版本还缺什么。过程中请尽量把你正在想什么说出来。

Do not explain the five steps, define a divergence point, point to a control, or
tell the participant which interpretation is correct.

## Required participant outcomes

The participant should independently:

1. state the intended final output;
2. keep the readable rulebook and reject the corrupt mirror;
3. accept the high-confidence three-punt candidate;
4. resolve the 16/20 accomplice discrepancy using the source anchor;
5. handle the missing asset without claiming publication readiness;
6. compare the pilot/pirate interpretations and make or defer a decision;
7. predict the runtime consequence before compiling;
8. compile and open the playable build;
9. find the validation report;
10. name at least one unsupported runtime area and the licensing blocker.

## Facilitator boundary

Allowed:

- repeat the starting scenario;
- remind the participant to think aloud;
- ask “你现在认为系统要你做什么？”;
- ask “你觉得这个选择会改变什么？”;
- stop for a technical failure or safety issue.

Not allowed:

- identify the correct control or interpretation;
- define interface terminology;
- reveal that a decision is required;
- tell the participant to scroll;
- repair a participant mistake;
- count a rescued completion as independent.

Every prohibited intervention that becomes necessary is a facilitator rescue
and must be timestamped.

## Evidence to capture

- start and end time;
- time entering each step;
- first click in each step;
- first-click errors;
- backtracking and undo use;
- facilitator rescues;
- spoken questions and unclear terms;
- predicted consequence of the component and rule decisions;
- source conflict result;
- compilation and playable-open result;
- validation-report finding;
- post-session confidence from 1–5;
- the single most confusing moment in the participant's words.

## Track A pass gate

Do not average away failures. Track A passes only when:

- at least 2 of 3 participants compile and open the playable build without a
  facilitator rescue;
- all participants can state the overall goal and current step;
- at least 2 of 3 choose the source-backed 20 accomplices and resolve the seeded
  rule conflict using source evidence;
- no participant mistakes an AI candidate for an authoritative rule;
- no participant silently bypasses an unresolved blocking rule;
- every observed issue is converted into a ranked evidence-backed ticket.

If the gate fails, keep issue 05 unresolved and return to the highest-ranked
Track A defect. Do not begin Track B.

