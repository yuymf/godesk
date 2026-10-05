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
| 代码基线 | `yuymf/godesk` `main` @ `60780f736c7f554482bdcffa6c4202dd83ca7637` |
| 状态文件维护人 | 劳埃德(工程) |
| 最近更新 | 2026-10-05（Asia/Shanghai） |

## 硬约束（三条）

1. **最终验收 ≠ 仅汐屿可玩。** 验收标准是：带着 GoDesk 插件，创作者能做出与本 SPEC 同类型、同品质的游戏。汐屿是案例研究与默认底座演示。插件路径（生成 / 编辑 / 导入）必须复用同一套 3D 底座与 GameSpec v2 字段，并经实机 / 模拟 live 测试证明。
2. **Prompt 轨迹入库。** 每一次关键 C2C / Codex / goal-mode 提示词与决策轨迹写入仓内 `docs/prompt-trace/`，不得只留在聊天记录。约定见 [`docs/prompt-trace/README.md`](./prompt-trace/README.md)。
3. **状态继承文件。** 本文件（`docs/G3D-STATUS.md`）是唯一程序状态入口。每次合并或里程碑结束必须更新：当前里程碑、已完成 G3D id、进行中、阻塞、下一刀、开着的 PR/分支。

## 当前里程碑

| 项 | 值 |
| --- | --- |
| 里程碑 | **M0 治理**（未开始） |
| 本阶段出口 | G3D-01：ADR 0014 合并；3D 禁令常量与技能措辞删除 |
| Bootstrap | 进行中：落地本状态文件与 prompt-trace 约定（docs-only） |

## 已完成

| G3D id | 说明 | 证据 |
| --- | --- | --- |
| — | 尚无 G3D 产品任务合入 | — |

仓外已完成（不记入上表）：SPEC v0.2 起草与 §9 拍板修订；Notion 项目与任务卡建立。

## 进行中

| 项 | 负责人 | 分支 / PR | 说明 |
| --- | --- | --- | --- |
| Bootstrap：状态骨架 + prompt-trace 约定 | 劳埃德(工程) | `feat/g3d-bootstrap-status` | docs-only；不含产品代码 |

## 阻塞

| 项 | 原因 | 解除条件 |
| --- | --- | --- |
| C2C bridge 就绪性 | 本 bootstrap 刀未在本环境验证 C2C / Codex bridge 是否可用；由并行检查跟进 | 并行检查确认 bridge 可用，或记录明确失败原因并换刀路径；coding 刀开工前必须解除 |

## 下一刀

1. 合并本 bootstrap PR（docs-only）。
2. **G3D-01（M0）**：提交 ADR 0014，删除 2D 限定常量与技能措辞。Coding 刀必须走 C2C + goal-mode，并在 `docs/prompt-trace/` 留轨迹。

## 开着的 PR / 分支

| 分支 | PR | 范围 | 状态 |
| --- | --- | --- | --- |
| `feat/g3d-bootstrap-status` | （本 PR，创建后回填编号） | `docs/G3D-STATUS.md`、`docs/G3D-SPEC-POINTER.md`、`docs/prompt-trace/` | open |

## 修订记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-10-05 | 初创：硬约束三条、M0 未开始、bootstrap 进行中、C2C bridge 阻塞行、下一刀指向 G3D-01 | 劳埃德(工程) |
