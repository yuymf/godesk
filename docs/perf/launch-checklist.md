# G3D-17 上线前清单自动化（发布闸门）

`scripts/launch-checklist.mjs` 把 G3D-17 发布门里**可以机器检查**的项汇成一张表。现在是 **warning 模式**：只写 Step Summary 和 GitHub `::warning` 注解，不改变 CI 结果。到 G3D-17 改一行环境变量即可转为阻断。

法务审查结论、生产上线、删除 `GODESK_FEATURE_TIDEWELL` 开关、模拟画像终验（有 GPU 的机器）仍须人工完成，见 [`docs/G3D-STATUS.md`](../G3D-STATUS.md)「G3D-17 上线前清单」。

## 检查项

| id | 内容 | 数据来源 | pass 条件 | 当前（2026-10-06） |
| --- | --- | --- | --- | --- |
| `asset-legal` | `LicenseRef-AI-Generated` 待法务审查条数 | `node scripts/verify-assets.mjs --skip-network --json` → `summary.aiPendingLegalReview` | 0，且 verify-assets 通过 | warn：68 项 |
| `size-budgets` | 首页 / render3d 核心 / assets / 懒加载 chunk 体积 | `size-limit --json` + `scripts/check-size-budgets.mjs`（需先 `pnpm build`） | 全部不超限，且每项余量 ≥ 2% | warn：size-limit 首页 168.68 / 170 kB，余量 0.8% |
| `lighthouse` | `lighthouserc.json` 里仍为 `"warn"` 级的断言（首页 LCP、Room TBT、Room CLS） | `lighthouserc.json` + `.lighthouseci/lhr-*.json`（median-run） | 没有 warn 级断言（都已改成 error） | warn：3 条仍为 warn 级 |
| `draw-calls` | 六角岛 Room 分档 draw call：稳态和峰值取较大者，对照 §4.6.3（high 150 / medium 100 / low 60） | `pnpm perf:ci` 的 `ci-budgets.json` → `launchChecklist.tierDrawCalls`（high 取冷启动那次采样；medium / low 用 `?tier=` 强制档位） | 三档都不超预算 | fail：high 140 / 140；medium 80 / 140；low 80 / 121（稳态 / 峰值，SwiftShader） |
| `hud-raw-action-ids` | Room 可见文本和 aria-label 里的原始动作 id：边坐标串 `-200:173\|-250:87`、顶点键、`action_…` / UUID、`place_road` 一类动作类型 | `ci-budgets.json` → `launchChecklist.hudRawActionIds`（桌面 1440×900 + iPhone 12 Pro，不带 `?perf=1`） | 两个视口都是 0 | warn：桌面与 iPhone 各 54 种顶点坐标键（「放置定居点 · -100:-173」等，开局放置阶段） |

状态取值：`pass` / `warn` / `fail` / `missing`（输入缺失，例如没跑 perf:ci）。

## CI 接线

- `verify.yml`：在 `pnpm perf:ci` 之后运行（`if: always()`），检查 `asset-legal`、`size-budgets`、`draw-calls`、`hud-raw-action-ids`。报告写入 `perf-results/launch-checklist.json`，随 `perf-ci-budgets` artifact 上传。
- `lighthouse.yml`：在 `lhci autorun` 之后运行（`if: always()`），只检查 `lighthouse`。报告写入 `.lighthouseci/launch-checklist.json`，随 `lighthouse-reports` artifact 上传。
- `perf:ci` 新增的分档采样和 HUD 扫描**不进** `ci-budgets.json` 的 `pass`，所以现有 CI 门不变。

## 本地运行

```bash
pnpm build
pnpm perf:ci --out perf-results            # 或 --room-url <已有房间>
pnpm launch:check --perf perf-results/ci-budgets.json --out launch-checklist.json
pnpm launch:check --only lighthouse --lighthouse .lighthouseci   # 跑过 lhci 之后
```

## 转阻断（G3D-17）

开关一：全量阻断。把两个 workflow 里清单步骤的 `GODESK_LAUNCH_GATE: warn` 改为 `block`。之后任一项非 `pass`（`missing` 也算）都会让该步骤退出码为 1，注解从 warning 变为 error。命令行等价写法是 `--mode block`。

开关二：逐项转正。保持 `warn`，在 `GODESK_LAUNCH_GATE_BLOCK` 填逗号分隔的 id（例如 `asset-legal,hud-raw-action-ids`），只让这些项阻断。命令行等价写法是 `--block <id,...>`。

建议顺序：

1. G3D-13 HUD 合入后，HUD 扫描应为 0，先转正 `hud-raw-action-ids`。
2. 法务清零后转正 `asset-legal`。把 `assets/LICENSES.md` 的 `法务审查: 待 G3D-17` 改为 `法务审查: 已通过 <日期/审查人>`，并把 manifest 的 `legalReview` 改为 `"cleared"`。
3. Lighthouse：按 STATUS G3D-05 备注 ⑤，在 G3D-17 前完成 LCP / TBT 优化，把 `lighthouserc.json` 里对应断言的 `"warn"` 改为 `"error"`，清单的 `lighthouse` 项随之变为 pass。
4. `draw-calls` 的 low 档要等合批 / 实例化落地（G3D-07 备注 ①）。
5. 最后把 `GODESK_LAUNCH_GATE` 改为 `block`。

## 维护

- 预算数据来自 `scripts/perf/budgets.mjs`（与 `docs/perf/emulation-protocol.md` 同步）。
- 原始 id 规则在 `scripts/perf/hud-raw-ids.mjs`，单测在 `scripts/launch-checklist.test.mjs`。误报时先在单测里加反例再调整规则。
