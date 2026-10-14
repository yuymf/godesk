# T074 — stage debug overlay purge

| 字段 | 值 |
| --- | --- |
| 回归靶 | H03 + ≥1 其他 suite before/after；unit |
| 层 | **共享呈现** |
| 状态 | **开** |
| tip | pending |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t074/` |

## 问题
桌面仍见 `gold: 0` 等开发名牌 / 裸数字盒。

## 实现
1. 清扫全 kernel 3D stage debug overlay；生产 Room 不显开发标签。
2. **不**自宣 ≥9。
