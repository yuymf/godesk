# T012 — 现代艺术多模式拍卖/行情卖出超出 harbor 子集

| 字段 | 值 |
| --- | --- |
| 套件 | H05-modern-art probe3 |
| 层 | **内核**（auction-bidding-v1 gallery subset） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H05-probe3/` |
| 状态 | **已关** · gallery 子集落地；H05 floor passed；趋向 SUCCESS（仍部分） |

## 现象（probe1）
正确绑 auction-bidding harbor；缺：定价购、双画、画家行情阶梯卖出、3–5 人。playabilityFloor failed.

## 期望
扩拍卖模式矩阵 + 行情卖出；或 unsupported 点名「无 modern-art 多模式/行情」。

## 最小通用修法
通用 auction modes 枚举 + market track；勿为单一 IP 特判。

## 实现（gallery subset · 并行于 harbor，不扭曲 harbor）

| 支柱 | 落地 |
| --- | --- |
| 模式 | `open` / `sealed` / `fixed`（拍卖官 `play_painting` 选模式） |
| 行情 | 同画家售出达阈 → 行情阶梯累计 → `market` 阶段按画家价 `sell` |
| 检测 | `GALLERY_AUCTION_CUES` 优先于 harbor（H05 含流拍也不进 harbor） |
| 诚实 unsupported | 3–5 席、双画固定、精确补牌 — **仅部分能力** |

## 关闭（probe3）
- H05-probe3：gallery executable + playability/presentation passed；非 AB
- H03 smoke（gem-engine）：无回归
- harbor 单测仍绿（归档 H03-dark-harbor INPUT）
