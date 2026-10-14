# T013 — 通用 pattern-draft-v1（工厂草稿 / 准备行 / 纹样墙）

| 字段 | 值 |
| --- | --- |
| 套件 | H04-azul probe3 |
| 层 | **内核** |
| 状态 | **已关** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H04-probe3/` |

## 现象（probe2）
诚实 draft + `generationRefuse=pattern-draft`（T009）；无工厂草稿可执行内核。

## 期望
新通用内核 `pattern-draft-v1`：工厂拿色 → 准备行 → 满行贴墙计分 → 地板扣分 → 轮转；H04 从诚实 draft → **executable playable**。不放松 SUCCESS。

## 实现

| 支柱 | 落地 |
| --- | --- |
| 草稿 | 工厂 / 中心同色 `draft`；余砖入中心；先手标记占地板格并定下轮先手 |
| 准备行 | 行长 1–5；同色；墙已有该色则不可放；溢出地板 |
| 墙贴 | 满行自动贴墙；正交相连计分；地板阶梯扣分 |
| 轮转 | 桌面空 → 结算 → 补厂 → 下轮 |
| 机械推断 | `pattern-draft` cues；corpus 绑内核而不再 refuse |

诚实 unsupported：3–4 席、行/列/颜色套终局奖励。

## 关闭（probe3）
- H04-probe3：pattern-draft-v1 + floors passed；非 AB
- smoke H02 / H03 / H05 无回归
