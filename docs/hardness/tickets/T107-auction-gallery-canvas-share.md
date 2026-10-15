# T107 — auction/gallery canvas share reclaim

| 字段 | 值 |
| --- | --- |
| 回归靶 | H05 seated/immersive canvasShare 明确抬升（对照 H02–H04 ≈0.78；不 regress shareReady/collapse） |
| 层 | **Room chrome / 布局** |
| 状态 | **开** |
| 来源 | T105 · H05 canvasShare≈0.493 |

## 问题
拍卖画廊布局仍挤占中央舞台，canvasShare≈0.49，落后其它 kernel。

## 拟实现（通用）
immersive 下收窄非必要 chrome / 侧栏；通用 Room 布局，无样例特判。
