## 摘要

<!-- 本 PR 做什么、为什么 -->

## G3D 任务

- [ ] 关联 G3D-xx
- [ ] 已更新 `docs/G3D-STATUS.md`
- [ ] 已写入 `docs/prompt-trace/`（若本刀使用了 Codex / C2C）

## 资产与许可（SPEC §5.3）

- [ ] 本 PR 新增资产均已登记清单（`src/render3d/assets/manifest.ts` / `manifest.data.mjs`）与 `assets/LICENSES.md`，许可证为 cleared
- [ ] 未参考任何第三方产品的源码 / 模型 / 音频 / 插画 / 文案
- [ ] `pnpm verify:assets` 本地通过

## 验证

- [ ] `pnpm -s typecheck`
- [ ] `pnpm -s test`
- [ ] `pnpm test:e2e`（或说明为何本 PR 不触及用户可见路径）
- [ ] CI 全绿

## 证据（不入库）

<!-- PR 评论贴命令输出、CI 链接；截图放 /workspace/g3d-evidence/<task-id>/ -->
