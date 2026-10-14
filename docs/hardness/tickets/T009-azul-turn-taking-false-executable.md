# T009 — 花砖草稿题材弱回落 turn-taking executable

| 字段 | 值 |
| --- | --- |
| 套件 | H04-azul probe1 |
| 层 | **解析 / 配置** |
| 状态 | **已关** · sha `45adb74` / tip `114ef13` · H04-probe2 PASS（诚实 draft） |
| 证据 | `/workspace/g3d-evidence/godesk-2026-10-14/hardness-real/H04-probe2/` |

## 现象
无 pattern-draft 内核时标 **turn-taking-v1 executable**（自承不推断胜负/资源），造成假可玩。

## 期望
无对应内核 → draft + unsupported「无工厂草稿/纹样墙内核」；禁止空转 turn-taking 冒充通过。

## 最小通用修法
收紧 turn-taking 回落条件；或对「工厂/准备行/纹样墙」类 corpus 显式 capability gap。

## 关闭（probe2）
工厂/准备行/纹样墙 → `pattern-draft` refuse；禁止 turn-taking-v1 假 executable。冷启动 `H04-probe2`：draft + 可读 unsupported。
