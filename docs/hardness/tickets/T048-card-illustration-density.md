# T048 — 共享卡面插画密度

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 before/after close；H05 smoke；zone schema 单测 |
| 层 | **共享呈现**（card atlas / plaqueWithFace；叠 T034/T037） |
| 状态 | **关** |
| tip | `d64c9da` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t048/` |

## 问题
gem/auction 发展卡仍偏大数字 + 费用点，缺插画带；中心数字独占面。

## 实现（通用）
1. `CARD_FACE_ZONES`：illustration / rewardBar / prestige / cost / title。
2. `paintCardFace` 程序化笔刷插画带（无外部版权图）+ 奖励色条 + 费用行 + 声望角标。
3. 禁止 center-number-only。offer/live/development 共用 cardWithFace；plaque 加插画条。
4. **不**自宣 ≥9。

## 验收
- [x] H03 before/after close
- [x] H05 smoke
- [x] unit zone schema under `H0x-t048/`
