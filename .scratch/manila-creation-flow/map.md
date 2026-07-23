# Manila creation-flow map

Status: resolved

## Decisions so far

- Use real source fixtures for the user-authorized internal validation.
- Preserve source hashes and a rejected corrupt mirror in the provenance ledger.
- AI outputs candidates; human review is the promotion boundary.
- Use one source-anchored project model across all three UI variants.
- Keep a visible licensing blocker and explicit incomplete-rules coverage.
- Desktop and 390 px browser QA passed for A/B/C and the single-voyage
  inspector; setup constraints disable progress when invalid.
- User rejected the step-4 component inventory as a generated result because it
  was not playable. The acceptance gate now requires a complete human decision
  loop, bot turns, movement, settlement, winner, and restart.
- That gate now passes in automated tests and a browser-driven full voyage.
  The UI language was changed from “生成桌面对象” to “生成可玩成品”.

## Fog

- Which of the three variants best supports an unfamiliar designer requires a
  human usability session.
- Full multi-voyage economy, shares, loans, blind passengers, and some pirate
  choice edge cases need additional modeling after the playable-output gate.
