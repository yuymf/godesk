# T104 — seatMaterial clearcoat test green

| 字段 | 值 |
| --- | --- |
| 回归靶 | materials.test clearcoat/seatMaterial 绿；不 regress T090 座位色泽 |
| 层 | **共享呈现 / 测试** |
| 状态 | **关** |
| tip | `19fd2d7` |
| 来源 | 大主管 soft · materials.test clearcoat pre-red |

## 问题
测试仍按 r6tex matte（clearcoat 0）断言，与 T090 `clearcoat: 0.35` 冲突。

## 实现（通用）
对齐 materials.test 到 T090 seat clearcoat≈0.35；terrain wood 仍无 clearcoat；呈现无改。
