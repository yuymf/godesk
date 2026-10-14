# T056 — 拍卖席前 owned 框画 Room 可视（修 T053 H05）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 before/after seat-close 像素差明显；≥2 framed-art；禁中心画廊冒充 |
| 层 | **共享呈现**（auction seat collection mesh/scale/camera） |
| 状态 | **关** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t056/` |

## 问题
T053 H05 collection-state lots:2 但 Room 席前 before≈after（mean≈0.58，changed≈0.4%）。根因：5 席 `seatTableauOrigin` 把 seat0 推到 x≈-7.2（毡面 ±4.7 外），框画在画外；席前 size 过小像白牌。

## 实现（通用）
1. `seatTableauOrigin` 居中夹紧到毡面内（所有 kernel 共享）。
2. 席前 owned 框画加大 + 靠 meeple 前缘，frame+canvas 可读。
3. Room 像素门槛 mean_abs≥5 或 changed≥5%。**不**自宣 ≥9。

## 验收
- [x] H05 seat-close pixel gate
- [x] unit seat:N:coll → framed-art readable size
- [x] 禁中心画廊 / 白牌冒充
