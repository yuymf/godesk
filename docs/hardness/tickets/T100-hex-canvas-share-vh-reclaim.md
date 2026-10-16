# T100 — hex canvas share / vh reclaim

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 seated canvasShare 明确 >0.50；不 regress T097 collapse / shareReady / purge |
| 层 | **Room chrome / Tidewell layout** |
| 状态 | **关** |
| tip | `01f9a17` |
| 来源 | 大主管 soft · H01 canvasShare≈0.496 flat |

## 问题
双轨 `--tw-side: 260px` 挤窄中央舞台，canvasShare 卡在 ~0.496。

## 拟实现（通用）
seated immersive 收窄 side / dock；保留 shareReady 折叠条。
