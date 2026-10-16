# T080 — room share chrome production

| 字段 | 值 |
| --- | --- |
| 回归靶 | H01+H03 stage before/after；试玩反馈不抢桌面；hasDevTone=false |
| 层 | **共享呈现 / Room chrome** |
| 状态 | **关** |
| tip | `02d1070` |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H0x-t080/` |

## 问题
可分享 Room 顶栏像本地调试地址栏；试玩反馈条默认抢桌面焦点。

## 实现（通用）
1. 全 tabletop/immersive kernel：试玩反馈默认折叠 off-table drawer。
2. 入座后分享条保留「复制链接 + 席位」，掩蔽 raw localhost URL。
3. 不改玩法语义。**不**自宣 ≥9。
