# T059 — pattern line force-draft Room

| 字段 | 值 |
| --- | --- |
| 回归靶 | H04 before/after lines-close；砖入槽道可读；像素门；T036/T047/T050/T054/T058 绿 |
| 层 | **共享呈现 / force-inject** |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t059/` |

## 问题
T058 空槽道 OK，但 Room 无行内 glazed 砖 / 地板罚砖 → 死灰楔。

## 实现（通用）
1. `forceDraftPattern`：真实 `draft` intents（source/color/line）；禁 H04/Azul pack 硬编码。
2. 席位 ≥1 行可读釉砖 + 地板 ≥1 罚砖。
3. 像素门 lines-close mean_abs≥5 OR changed≥20 ≥5%。**不**自宣 ≥9。
