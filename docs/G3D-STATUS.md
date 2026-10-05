# GoDesk 3D 程序状态（G3D）

任何人打开本仓库即可从本文件判断当前进度。每次里程碑结束或相关 PR 合并后必须更新本文件。

## 元信息

| 项 | 值 |
| --- | --- |
| 程序代号 | G3D |
| 招牌演示 | 汐屿 / Tidewell Isles（`tidewell-isles`） |
| SPEC | 仓外 `/workspace/godesk-3d-spec/SPEC.md`（v0.2）；指针见 [`docs/G3D-SPEC-POINTER.md`](./G3D-SPEC-POINTER.md) |
| Notion 项目 | https://app.notion.com/p/3f05fabdfe81810e90ade6b4fe2de7c2 |
| 任务范围 | G3D-01 至 G3D-27；里程碑 M0–M5；人日上限 91 |
| 代码基线 | `yuymf/godesk` `main` @ `332275d53219e3d6a9a3442a4abca8e432777b80`（#103 squash） |
| 状态文件维护人 | 劳埃德(工程) |
| 最近更新 | 2026-10-06（Asia/Shanghai） |

## 硬约束（三条）

1. **最终验收 ≠ 仅汐屿可玩。** 验收标准是：带着 GoDesk 插件，创作者能做出与本 SPEC 同类型、同品质的游戏。汐屿是案例研究与默认底座演示。插件路径（生成 / 编辑 / 导入）必须复用同一套 3D 底座与 GameSpec v2 字段，并经实机 / 模拟 live 测试证明。
2. **Prompt 轨迹入库。** 每一次关键 C2C / Codex / goal-mode 提示词与决策轨迹写入仓内 `docs/prompt-trace/`，不得只留在聊天记录。约定见 [`docs/prompt-trace/README.md`](./prompt-trace/README.md)。
3. **状态继承文件。** 本文件（`docs/G3D-STATUS.md`）是唯一程序状态入口。每次合并或里程碑结束必须更新：当前里程碑、已完成 G3D id、进行中、阻塞、下一刀、开着的 PR/分支。

## 审查与合入口径（2026-10-06）

C2C ChatGPT 审查闸门已由用户于 2026-10-06 作废；审查与写码均用 box Codex 高档 gpt-5.5；合入授权：满足 CI/本地测试/活测证据后按序 squash。

## 当前里程碑

| 项 | 值 |
| --- | --- |
| 里程碑 | **M1 最小端到端 3D 切片**（进行中） |
| 本阶段出口 | G3D-02 → G3D-03 → G3D-04 → G3D-18：六角岛 Room 在 3D 中与 AI 打完一整局（EP-D + EP-I）；`CatanBoard.tsx` 删除且 `rg CatanBoard` 在 `src e2e` 为 0；e2e 全绿 |
| M0 | 已完成：Bootstrap #102（`f13c8ce`）、G3D-01 #103（`332275d`） |

## 已完成

| G3D id | 说明 | 证据 |
| --- | --- | --- |
| Bootstrap | 状态骨架 + prompt-trace 约定 | PR [#102](https://github.com/yuymf/godesk/pull/102) squash `f13c8ce` |
| G3D-01 | ADR 0014 + 删除旧 2D 限定常量与技能措辞 | PR [#103](https://github.com/yuymf/godesk/pull/103) squash `332275d` |

仓外已完成（不记入上表）：SPEC v0.2 起草与 §9 拍板修订；Notion 项目与任务卡建立。

## 进行中

| 项 | 负责人 | 分支 / PR | 说明 |
| --- | --- | --- | --- |
| G3D-02：three 依赖、`SceneHost` 动态加载与包体预算 | Track A · 劳埃德(工程) | `feat/g3d-02-scene-host` / PR TBD | M1 第一刀 |
| G3D-11：资产清单与许可证门（并行） | Track B | 见 Track B worktree | 不阻塞本 STATUS 行合并 |
| G3D-12：GameSpec v2（并行） | Track C | 见 Track C worktree | 不阻塞本 STATUS 行合并 |

## 阻塞

| 项 | 原因 | 解除条件 |
| --- | --- | --- |
| box Codex 用量上限 | `codex exec` gpt-5.5 于 2026-10-06 03:00 CST 报 usage limit（约至 2026-11-05）；G3D-02 改由 Track A 直接落码，审查改人工 diff + 测试门 | 用量恢复后恢复 Codex review pass；或用户另授替代模型 |

## 下一刀

1. 完成并合并 **G3D-02**（本分支）。
2. 随后按序 **G3D-03 → G3D-04 → G3D-18**（各独立 PR）。

## 开着的 PR / 分支

| 分支 | PR | 范围 | 状态 |
| --- | --- | --- | --- |
| `feat/g3d-02-scene-host` | TBD | three、`SceneHost`、lazy 加载、size-limit、STATUS | 进行中 |

## 修订记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-10-05 | 初创：硬约束三条、M0 未开始、bootstrap 进行中、C2C bridge 阻塞行、下一刀指向 G3D-01 | 劳埃德(工程) |
| 2026-10-05 | 回填开着的 PR：#102 | 劳埃德(工程) |
| 2026-10-06 | G3D-01 开工：M0 标为进行中；记录 `feat/g3d-01-adr-0014`、PR TBD、#102 仍 open；阻塞项改为 ChatGPT 侧 connector 重建；下一刀指向 M1 G3D-02 / 03 / 04 / 18 | 劳埃德(工程) |
| 2026-10-06 | 回填 G3D-01 PR #103；下一刀改为经授权合并后进入 M1 | 劳埃德(工程) |
| 2026-10-06 | #102 / #103 已 squash 合入；进入 M1；记录 C2C 作废与合入授权口径；G3D-02 开工；Codex 用量上限记入阻塞 | 劳埃德(工程) |
