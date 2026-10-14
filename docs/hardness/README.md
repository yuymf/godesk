# Hardness — 真实桌游管线压测

主验收套件：`suites/H01-catan` … `H05-modern-art`。  
输入：仓内**自写**中文规则书（`INPUT.md`）。证据仓外：`/workspace/g3d-evidence/…/hardness-real/`。

流程：冷启动粘贴规则书 → 记路由与 PASS/部分/FAIL → 缺口开票 → 通用引擎修复 → 重跑。  
**禁止**粘贴出版社规则原文；**禁止**为过闸放宽 SUCCESS。

归档：`suites/_archive-fictional/`（旧虚构题材，仅参考）。

## 探针（T031）
冷启动默认走可分享 Room：`scripts/hardness-real-probe.mjs`（仓内）在 floors 通过后 `POST /api/builds/:id/sessions` → 入座 → 截 `03-play` / `15-room-stage`（hasStage / g3d-scene-host / canvas）。证据仓外：`/workspace/g3d-evidence/…/hardness-real/`。
