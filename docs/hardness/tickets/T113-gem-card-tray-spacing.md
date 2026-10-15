# T113 — gem card tray spacing density

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 牌列托架间距可读；共享布局；不 regress canvasShare |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `af03902` |
| 来源 | T111 audit |

## 问题
H03 牌列托架柄/间距仍挤。

## 实现（通用）
market 列距/行距抬升、size 略收；共享 tabletop-kernels，无样例特判。
