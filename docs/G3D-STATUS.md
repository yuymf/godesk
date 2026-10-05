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
| 最近更新 | 2026-10-06（Asia/Shanghai） |

## 硬约束（三条）

1. **最终验收 ≠ 仅汐屿可玩。** 验收标准是：带着 GoDesk 插件，创作者能做出与本 SPEC 同类型、同品质的游戏。汐屿是案例研究与默认底座演示。插件路径（生成 / 编辑 / 导入）必须复用同一套 3D 底座与 GameSpec v2 字段，并经实机 / 模拟 live 测试证明。
2. **Prompt 轨迹入库。** 每一次关键 C2C / Codex / goal-mode 提示词与决策轨迹写入仓内 `docs/prompt-trace/`，不得只留在聊天记录。约定见 [`docs/prompt-trace/README.md`](./prompt-trace/README.md)。
3. **状态继承文件。** 本文件（`docs/G3D-STATUS.md`）是唯一程序状态入口。每次合并或里程碑结束必须更新：当前里程碑、已完成 G3D id、进行中、阻塞、下一刀、开着的 PR/分支。

## 当前里程碑

| 项 | 值 |
| --- | --- |
| 里程碑 | **M0 治理**（进行中） |
| 本阶段出口 | G3D-01：ADR 0014 合并；3D 禁令常量与技能措辞删除 |
| Bootstrap | PR #102 仍 open，尚未合并（`feat/g3d-bootstrap-status`） |

## 已完成

| G3D id | 说明 | 证据 |
| --- | --- | --- |
| — | 尚无 G3D 产品任务合入 | — |

仓外已完成（不记入上表）：SPEC v0.2 起草与 §9 拍板修订；Notion 项目与任务卡建立。

## 进行中

| 项 | 负责人 | 分支 / PR | 说明 |
| --- | --- | --- | --- |
| Bootstrap：状态骨架 + prompt-trace 约定 | 劳埃德(工程) | `feat/g3d-bootstrap-status` / PR #102 | docs-only；open，未合并 |
| G3D-01：ADR 0014 + 删除旧 2D 限定常量与技能措辞 | 劳埃德(工程) | `feat/g3d-01-adr-0014` / PR TBD | 本分支进行中；等待调用方提交并开 PR |

## 阻塞

| 项 | 原因 | 解除条件 |
| --- | --- | --- |
| C2C ChatGPT 侧 connector | ChatGPT 侧等待用户删除并重建 `Codex with ChatGPT · godesk` connector，使用新的 server URL；本地 bridge 在固定域名上已 green | 用户完成删除 + 重建 connector，ChatGPT 侧显示 Ready 后恢复 C2C plan/review |

## 下一刀

1. 提交并打开 **G3D-01（M0）** PR：ADR 0014、旧 2D 限定常量与技能措辞删除。
2. 合并或关闭 bootstrap PR #102 的状态分歧，确保主线含本状态文件。
3. 下一刀进入 **M1：G3D-02 / G3D-03 / G3D-04 / G3D-18**。

## 开着的 PR / 分支

| 分支 | PR | 范围 | 状态 |
| --- | --- | --- | --- |
| `feat/g3d-bootstrap-status` | [#102](https://github.com/yuymf/godesk/pull/102) | `docs/G3D-STATUS.md`、`docs/G3D-SPEC-POINTER.md`、`docs/prompt-trace/` | open |
| `feat/g3d-01-adr-0014` | TBD | ADR 0014、删除旧 2D 限定常量与技能措辞、G3D-01 prompt-trace | local in progress |

## 修订记录

| 日期 | 变更 | 作者 |
| --- | --- | --- |
| 2026-10-05 | 初创：硬约束三条、M0 未开始、bootstrap 进行中、C2C bridge 阻塞行、下一刀指向 G3D-01 | 劳埃德(工程) |
| 2026-10-05 | 回填开着的 PR：#102 | 劳埃德(工程) |
| 2026-10-06 | G3D-01 开工：M0 标为进行中；记录 `feat/g3d-01-adr-0014`、PR TBD、#102 仍 open；阻塞项改为 ChatGPT 侧 connector 重建；下一刀指向 M1 G3D-02 / 03 / 04 / 18 | 劳埃德(工程) |
