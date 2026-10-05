# Prompt trace · G3D-11 资产管线

## goal

落地 SPEC §6.3 G3D-11：资产清单、`assets/LICENSES.md`、CI 许可证门、KTX2/meshopt 压缩脚本、`render3d-assets` chunk（≤ 60 KB gzip）、`THIRD_PARTY_NOTICES.md`、PR 模板勾选。

## tool

- Codex CLI（计划：`gpt-5.5` + `model_reasoning_effort=high`；本刀实现以执行席手写 + Codex 审查为主）
- C2C/ChatGPT 审查：用户 2026-10-06 作废，改走 box Codex

## prompts used

### Codex plan（2026-10-06 约 02:49 Asia/Shanghai）

原文见仓外 `/tmp/g3d11-plan/prompt.md`。要点：要求只出实现计划、不写代码；强调 G3D-02 未合入时管线独立、three 若必需则钉 `0.186.1`；四类故意违规须使门失败。

该次 `codex exec` 进程卡在 stdin，无完整计划输出；执行席按 SPEC §5.1/§5.4/§6.3 直接实现，随后另开 Codex 审查 diff。

### 实现约束（用户硬规则摘要）

- 仅自有 / CC0-1.0 / OFL；逐项登记 `assets/LICENSES.md`
- 禁止 settlecoast 任何拷贝/描摹/下载
- 工作树 `/workspace/godesk-trackB`；不碰 `/workspace/godesk` 检出分支
- 合入前须 ADR 0014 已在 `origin/main`（已满足：`332275d`）

## decisions

1. 增加 `three@0.186.1` 与 `size-limit@14.1.0`：G3D-11 验收需要可度量的 `render3d-assets` chunk；版本与 SPEC §5.2 / G3D-02 对齐，rebase 时协调而非分叉版本。
2. `manualChunks` 将 `three` 核心与 loaders 拆开，避免 assets chunk 吞下整包 three（实测拆分后 gzip ≈ 26 KB，预算 60 KB）。
3. `manifest.data.mjs` 与 `manifest.ts` 双写：CI Node 脚本无需 TS 转译即可读清单。
4. `toktx` 未安装时压缩贴图路径硬失败并记 STATUS 阻塞；GLB meshopt 走 `@gltf-transform/cli`。
5. 登记既有 Manrope（OFL）与 GoDesk mark（自制），使许可证门从零资产日起即有真实行。

## outcomes

- 新增：`src/render3d/assets/*`、`assets/LICENSES.md`、`scripts/verify-assets.mjs`、`scripts/compress-assets.mjs`、`scripts/check-assets-chunk-size.mjs`、`THIRD_PARTY_NOTICES.md`、`.github/PULL_REQUEST_TEMPLATE.md`、`.size-limit.json`
- CI：`verify.yml` 在 build 后跑 `pnpm verify:assets` 与 `pnpm size`
- 证据目录（不入库）：`/workspace/g3d-evidence/G3D-11/`

## links

- Notion：https://app.notion.com/3f05fabdfe81814f8ee9e7369140a88e
- PR：TBD
- merge SHA：TBD
