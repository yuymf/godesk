# T103 — tidewell seated side-rail compact

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01 seated 侧栏卡片不挤；canvasShare≥0.62；不 regress T097/T100/shareReady |
| 层 | **Room chrome / Tidewell layout** |
| 状态 | **关** |
| tip | `19fd2d7` |
| 来源 | 大主管 soft · T100 后侧栏仍 cramped |

## 问题
T100 收窄 `--tw-side: 168px` 后玩家卡/头像仍按 64–72px 布局，侧栏视觉挤压。

## 实现（通用）
seated 下：avatar 36×44、card grid 40px、padding/字号收紧；隐藏 awards；保留 shareReady 与 canvasShare。
