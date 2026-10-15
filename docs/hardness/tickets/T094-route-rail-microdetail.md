# T094 — route rail microdetail

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 stage-close/wide：轨道路径 albedo/normal/roughness 微细节可读；不伤 T079/T081 接触阴影 |
| 层 | **共享呈现**（network-route 路径材质） |
| 状态 | **关** |
| 来源 | T093 respotcheck |

## 问题
H02 轨道路径仍偏均匀灰塑料，缺与毡/木缘对齐的共享微细节。

## 拟实现（通用）
共享 rail/path material（grain 或 tread），全 network-route kernel；无样例特判。
