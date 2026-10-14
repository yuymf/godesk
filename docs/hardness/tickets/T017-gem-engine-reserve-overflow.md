# T017 — gem-engine：保留手 / token 溢出规则

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03（harness only） |
| 层 | **内核**（gem-engine-v1 同层扩） |
| 状态 | **已关** |
| sha | `2c020a25507aebbb7483ca1fbef7e6754ee24d32` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H03-t017/` |

## 现象（Open · regress-t015）
gem-engine-v1 可玩子集已过 floor；仍缺 **reserve hand**、**3–4 席**、**complex gold overflow UI**（席位见 T019）。

## 实现（通用）
- **Reserve hand**：`reserve` 市场或牌库顶 → `reserved[]`（上限 3）；银行有金则拿 1 金；`buy_reserved` 支付购买
- **Token overflow**：拿币可暂超 10；`pendingDiscardSeat` 下仅 `discard_gems` 直至 ≤10 再结束回合
- unsupported 收窄为 **3–4 席**（→ T019）

未重做贵族/牌级。无样例 IP 特判。Collecta 未动。#179 draft 未合 main。

## 关闭
- H03-t017：floors passed；记分趋向 SUCCESS（可玩子集）
- H02 smoke：无回归
- 单元：gem-engine 7 passed（含 T017 3 例）
