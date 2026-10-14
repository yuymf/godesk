# T032 — 共享桌面可点交互

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04（及 H05）Room 桌面拾取 |
| 层 | **共享呈现**（TabletopStage / legal 过滤 / 悬停抬起） |
| 状态 | **关** |
| tip |  |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t032/` |

## 现象
T026–T028 桌面已挂，但合法动作主要靠底部 DOM 按钮；牌/币/碟常无法按合法集高亮与点击。

## 实现（通用）
1. Gem/Pattern boards 算 legal → `TabletopStage`；layout 仅对合法动作挂 `action` / hint 环；bank take_pair 可点。
2. SceneHost 悬停抬起 + pointer cursor。
3. 单测 `tabletop-desk-click-t032.test.ts`。无样例特判。

## 验收对照
- [x] H03+H04+H05 Room 点击证据（20/21）
- [x] 单测通过；#179 draft；Collecta/T021 未动
