# Prompt trace — hardness baseline / H01 cycle 1（2026-10-14）

## Spec
- [`docs/hardness/ACCEPTANCE.md`](../hardness/ACCEPTANCE.md)
- Index: [`docs/hardness/README.md`](../hardness/README.md)

## Evidence（仓外）
`/workspace/g3d-evidence/godesk-2026-10-14/hardness/` — `H01-run1`…`H01-run3`、`baseline/RULEBOOK.md`

## Three columns（摘要）
见 `H01-run3/THREE_COLUMN.md`：NL 能生成可玩 ember 自走棋并打完一回合；灰烬单位/羁绊表未进 content；最卡层=内容生成（T003）。

## Engine fixes this cycle
- T001：`startHp` 排除胜负语境（降至/地板/淘汰…）
- T002：pack cue 否定（非/不得使用…）不选 cyber
