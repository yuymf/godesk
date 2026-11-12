# godesk 专属技能正本

本目录是 godesk 专属技能的正本，随仓库 git 追踪。
各席位通过软链引用：`profiles/<席>/skills/<分类>/<技能名>` -> 此处。
改技能只改这里，不要改席位目录下的副本（它只是软链）。

## 现状

| 技能 | 席位软链 |
|---|---|
| `godesk-branch-cleanup` | `profiles/lloyd/skills/devops/` |
| `godesk-deterministic-harness` | `profiles/luffy/skills/software-development/` |
| `godesk-secret-gate` | `profiles/franky/skills/devops/` |
| `godesk-ci-gates` | 无（仅 chief 经 `~/.hermes/project-skills/godesk` 挂载） |
| `godesk-pixel-gate` | 无（同上） |

## 约束

- 技能正文讲的是这个仓库的规矩，**跟着代码走**：改规则 = 改这里 + 随 PR 提交。
- 反向软链（本目录指向席位目录）禁止：git 追不到仓外路径，等于没有正本。
- 不放凭据、不放产物、不放通用文档。
