# T107 — auction/gallery canvas share reclaim

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 seated/immersive canvasShare 明确抬升（>0.50；不 regress shareReady/collapse） |
| 层 | **Room chrome / 布局** |
| 状态 | **关** |
| tip | `d508ead` |
| 来源 | T105 · H05 canvasShare≈0.493 |

## 问题
拍卖画廊 `min(960px)` 挤占中央舞台。

## 实现（通用）
immersive auction-board 全宽（对齐 network immersive）；保留 shareReady/collapse。
