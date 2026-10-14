# T012 — 现代艺术多模式拍卖/行情卖出超出 harbor 子集

| 字段 | 值 |
| --- | --- |
| 套件 | H05-modern-art probe1 |
| 层 | **内核** |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H05-probe1/` |

## 现象
正确绑 auction-bidding harbor；缺：定价购、双画、画家行情阶梯卖出、3–5 人。playabilityFloor failed。

## 期望
扩拍卖模式矩阵 + 行情卖出；或 unsupported 点名「无 modern-art 多模式/行情」。

## 最小通用修法
通用 auction modes 枚举 + market track；勿为单一 IP 特判。
