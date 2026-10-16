# T109 — route rail albedo contrast（T094 软续）

| 字段 | 值 |
| --- | --- |
| 回归靶 | H02 stage-wide 路径相对绿毡可读；不砍 T094 |
| 层 | **共享呈现** |
| 状态 | **关** |
| tip | `8251050` |
| 来源 | T105 · H02 路径仍偏灰平 |

## 问题
T094 后 network-route 轨道路径仍灰平，stage-wide 对比不足。

## 实现（通用）
ballast/sleeper/steel albedo+shade 抬升；保留 T094 maps / T078 cold bed。
