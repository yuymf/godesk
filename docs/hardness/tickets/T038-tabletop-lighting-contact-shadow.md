# T038 — 共享 TabletopStage 光照/接触影保真

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room 同机位光照/落影 |
| 层 | **共享呈现**（SceneHost lighting / tabletop-objects / MaterialLibrary env） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t038/` |

## 现象
牌/币/釉砖/匾额脚下缺软接触影；毡面偏“吃不住光”；与 high-tier key/fill/env 约定未对齐。

## 实现（通用）
1. 牌/币/釉砖/匾额脚下 soft contact shadow（或等价接地影）。
2. key/fill/env 对齐 SceneHost high-tier（复用 MaterialLibrary env OK）；毡面 roughness 抬高更吃光。
3. 单测不回退；无样例特判。**不**自宣 ≥9。

## 验收对照
- [ ] H03/H04/H05 before(T037)/after 同机位
- [ ] 单测不回退；无样例特判
