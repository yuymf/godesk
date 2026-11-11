# 项目级技能目录（`.agent/`）

**这是什么**：godesk 这个仓库**自己的** agent 技能目录。放「这个项目的坑」——只有在这个仓里干活才需要的判据、命令、实测数字。

**这不是什么**：不是通用文档（产品/架构说明留在 `docs/`）、不是 `AGENTS.md` 的替代、不是放凭据/构建产物/临时脚本的地方。

## 为什么要放进仓库

项目知识原来堆在某个 agent 的 profile 里（`profiles/chief/skills/`）：换人接手看不见、仓库归档后技能变孤儿、profile 的技能索引越来越臃肿。放进仓库后，技能跟代码同版本、同 review、同归档。

## 目录约定

```
.agent/
  README.md                       ← 本文件
  skills/<skill-name>/SKILL.md    ← 一个技能一个目录
```

每个 `SKILL.md` 必须有 frontmatter：

```yaml
---
name: <与目录名一致>
description: <≤60 字，写"什么时候用 + 干什么"，索引里只显示这一行>
---
```

正文写**判据和坑**（可核实的命令、实测数字、被否掉的错做法），不要写流水账进度；细节正本留在 `docs/`，技能里给路径指针。

## 怎么被加载（Hermes）

各席 profile 的 `skills.external_dirs` 都指向一个软链农场，而不是逐个列项目：

```yaml
skills:
  external_dirs:
    - /home/halyu/.hermes/project-skills
```

```bash
~/.hermes/project-skills/godesk → /home/halyu/Downloads/Code/godesk/.agent/skills
```

**必须是符号链接，不要复制**：复制出来的副本会和仓库版本漂移，改一处另一处不知道。

- 加载器 `os.walk(..., followlinks=True)` 会跟随软链，深度不限 ⇒ 目录结构可以自由加层级。
- 同一 tier 内同名但没有软链/字节同一性关系会导致 **Ambiguous skill name** 拒绝加载，别在两个项目里用同一个 skill 名。
- 改动在**新会话**生效（技能索引启动时构建）。

### 其他工具

Claude Code / Codex / omp 等默认不会读 `.agent/`，需要各自挂载（例如把 `.agent/skills` 软链到它们认的目录）。用 `.agent`（单数）是因为它中立，不被任何单一工具绑定；若某个工具只认 `.agents/skills`，用软链桥接，别把内容搬第二份。

## 谁维护

项目 owner 派单落地（godesk 试点由 franky 建立）。新增/改动技能直接进本目录，同一个 PR 里改，跟代码一起 review —— 基线、阈值、门禁类技能改动尤其要有人看。

## 现状

| 技能 | 来源 | 覆盖什么 |
| --- | --- | --- |
| `godesk-secret-gate` | 迁自 franky 席位（原文照搬） | 公开仓 secret 门：gitleaks 规则集、Cloudflare 标识符事件、提交前扫描 |
| `godesk-branch-cleanup` | 迁自 lloyd 席位（原文照搬） | PR 合并后的分支收尾常驻职责、可删判据 |
| `godesk-deterministic-harness` | 迁自 luffy 席位（原文照搬） | `?harness=1` 四件套：固定 dt、播种 RNG、digest、step/stepUntil |
| `godesk-pixel-gate` | 由 `docs/visual-regression-gate.md` 蒸馏（franky） | 像素门：端口独占、冻结自证链、环境专属基线、零容忍阈值 |
| `godesk-ci-gates` | 由 `docs/ci/harness-and-pixelgate-ci.md` 蒸馏（franky） | spec 归属、Actions job 接线、box runner 约束 |

蒸馏的两份是「入口与避坑清单」，判据冲突时以 `docs/` 与代码为准，并回来修技能。
