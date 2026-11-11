---
name: godesk-branch-cleanup
description: "Use when sweeping merged GoDesk branches after a PR merge."
version: 1.0.0
author: lloyd
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [git, branch, cleanup, godesk, standing-duty]
    related_skills: [ephemeral-worktree-hygiene, branch-backlog-merge]
---

# GoDesk 分支收尾（常驻职责）

每次 PR 合并后清主干分支，不用逐次请示。这是常驻职责，不是一次性任务。

## When to Use (何时用)

- 一个 PR 刚合并到 main；
- 用户要求「所有主干分支清干净」；
- 定期体检发现远端残留已合分支。

## 判据：内容是否真的已在 main

**权威判据是「分支相对 main 有无唯一提交」，不是 `git cherry`。**

```bash
# 唯一提交数 —— 0 才是真已合
git rev-list --count origin/main..origin/<branch>

# 内容差异（三点！）
git diff origin/main...origin/<branch> --stat
```

- `unique_commits=0` 且三点 diff 为空 ⇒ **内容已在 main，可删**
- `unique_commits>0` ⇒ 分支有 main 里没有的提交 ⇒ **不能凭空删**，需 PR 已 MERGED 才能删

### 三个假信号，别被骗

1. **`git cherry` 在 squash 合并后永远显示 `+`** —— squash 让提交哈希全变，cherry 认不出来。这是假信号，不要据此保留分支。
2. **两点 diff（`git diff main branch`）在 main 前进后必然非空** —— 它直接比两棵树，main 有新提交就显示差异。必须用三点 `main...branch` 比 merge-base。
3. **`ahead/behind` 单独看会误判** —— `behind=14 ahead=0` 才是「分支内容已全进 main，只是自己没跟上」；`ahead>0` 才是真有独有工作。

## 执行顺序

```bash
# 1. 清远端陈旧引用 + 拿最新状态
git fetch --prune

# 2. 清 kanban workspace 留下的幽灵 worktree
#    branch -D 报 "already checked out at <不存在路径>" 时先做这步
git worktree prune

# 3. 逐分支判定
for b in $(git branch -r --format='%(refname:short)' | grep -v 'origin/HEAD' | grep -v '/main$' | sed 's|origin/||'); do
  n=$(git rev-list --count origin/main..origin/$b)
  d=$(git diff origin/main...origin/$b --stat | tail -1)
  echo "$b | unique=$n | ${d:-<content identical>}"
done

# 4. 删已合分支（本地 + 远端）
git branch -D <merged-branch>
git push origin --delete <merged-branch>
```

## 边界

- **删远端不可逆**，但这一类收尾动作已获用户授权，不必逐次请示 —— 前提是**先验内容确实在 main**。
- **判断不清就不删**：`unique_commits>0` 且无法确认 PR 状态时，保留并上报，不要赌。
- 只删本次范围内的主干分支；不碰他人正在开发的功能分支。

## 凭据坑（实测）

远端操作会因凭据失效整条链停摆：

```
fatal: could not read Username for 'https://github.com': Device not configured
gh auth status -> The token in default is invalid.
```

`git fetch --prune` 与 `git push --delete` 都会失败。此时**只能做本地清理**，远端删除必须等凭据恢复。不要用 `GIT_TERMINAL_PROMPT=0` 硬试，那只是把挂起变成快速失败，凭据仍然没有。

## 删除命令会撞用户确认闸门

批量分支删除常被系统判为不可逆操作而拦截（等待用户确认超时即中止）。这**不是故障**，是设计。撞上时：

- 不重试、不换命令绕；
- 把「已验明可删的清单」和「阻断原因」一起上报，让用户一次性放行。

## 验收清单

| 项 | 检查 |
|---|---|
| 每个被删分支 | `unique_commits=0` 且三点 diff 为空 |
| worktree | `git worktree prune --dry-run` 无输出 |
| 远端引用 | `git branch -r` 无已合分支 |
| 回执 | 列出删了什么 + 判据数字，不只写「已清理」 |
