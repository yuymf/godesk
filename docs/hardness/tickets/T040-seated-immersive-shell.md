# T040 — 共享「入座沉浸壳」

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 / H04 / H05 Room chromeH↓ / stageTop↑ |
| 层 | **Room 壳 / 呈现**（header + invitation + stage overlay） |
| 状态 | **开** |
| tip | （实现后填） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t040/` |

## 现象
入座沉浸后顶栏 URL/席位仍偏厚；回合/供应状态常以大白页头抢焦点，桌面被挤。

## 实现（通用）
1. seated + tabletop immersive：顶栏收成窄图标行（仍可复制链接 / 换座）。
2. 回合/供应状态进台面 overlay；**禁止**大白页头抢焦点。
3. 证据三套 before/after + `chromeH` / `stageTop` 指标。无样例特判。**不**自宣 ≥9。

## 验收对照
- [ ] 三套 chrome 高度↓、stageTop 更靠上
- [ ] 无大白页头挡桌
