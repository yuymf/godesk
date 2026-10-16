# T053 — 席位购入落桌 Room 强制购入成对实证

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 force-buy≥2 卡 / H05 force-own≥2 藏品 before→after；H04 smoke |
| 层 | **共享呈现 / probe**（force-buy · force-own intents + seatTableau） |
| 状态 | **关** |
| tip | `9f2d679` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t053/` |

## 问题
T052 scaffold PASS（unit owned→seat）但 Room 缺强制购入成对实证：H03 `tableau-state` cards:0；H05 中心画廊有框、席前空白。

## 实现（通用）
1. `scripts/hardness-force-inject.mjs`：claimAllSeats + forceBuyGemCards + forceOwnAuctionLots（真实 intents，无 H03/H05 sample 特判）。
2. 他席 reserve-from-deck 推进回合，避免抽干银行。
3. Unit：cards≥2 / lots≥2 seat-front；Room guard JSON。
4. **不**自宣 ≥9。

## 验收
- [x] H03 before empty / after seat-close cards≥2 + gems countable
- [x] H05 before blank seat / after framed-art≥2 on seat（非仅中心画廊）
- [x] H04 smoke（T050 墙仍在）
- [x] 禁止 unit-only 或冷启动空桌当验收
