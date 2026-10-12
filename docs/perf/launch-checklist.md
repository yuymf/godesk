# G3D-17 上线前清单自动化（发布闸门）

`scripts/launch-checklist.mjs` 把 G3D-17 发布门里**可以机器检查**的项汇成一张表。

**G3D-17（本刀）进度：** 整体仍是 `GODESK_LAUNCH_GATE=warn`；已用 `GODESK_LAUNCH_GATE_BLOCK` 逐项转正 **`asset-legal`**、**`hud-raw-action-ids`**、**`draw-calls`**。首页 `GODESK_FEATURE_TIDEWELL` 开关已删除（生产默认汐屿 showcase）。全量 `block` 仍待 `size-budgets` / `lighthouse` / `draw-calls` 诚实达标。模拟画像终验仍须有 GPU 的机器，见 [`docs/G3D-STATUS.md`](../G3D-STATUS.md)「G3D-17 上线前清单」。

## 检查项

| id | 内容 | 数据来源 | pass 条件 | 当前（2026-10-12 · G3D-17） |
| --- | --- | --- | --- | --- |
| `asset-legal` | `LicenseRef-AI-Generated` 待法务审查条数 | `verify-assets --json` → `summary.aiPendingLegalReview` | 0，且 verify-assets 通过 | **pass · 已阻断**：用户 2026-10-06 豁免后 LICENSES / manifest 改为「已豁免 / cleared」 |
| `size-budgets` | 首页 / render3d 核心 / assets / 懒加载 chunk 体积 | `size-limit --json` + `check-size-budgets.mjs`（需先 `pnpm build`） | 全部不超限，且每项余量 ≥ 2% | 仍 **warn/测**：见本刀证据；未入 BLOCK |
| `lighthouse` | `lighthouserc.json` 里仍为 `"warn"` 级的断言（首页 LCP、Room TBT、Room CLS） | `lighthouserc.json` + `.lighthouseci/lhr-*.json` | 没有 warn 级断言（都已改成 error） | 仍 **warn**：3 条断言仍为 warn 级（未改 error） |
| `draw-calls` | 六角岛 Room 分档 draw call：稳态和峰值取较大者，对照 §4.6.3（high 150 / medium 100 / low 60） | `perf:ci` → `launchChecklist.tierDrawCalls` | 三档都不超预算 | **pass · 已阻断**（2026-10-12：high 47/47、medium 32/47、low 23/24） |
| `hud-raw-action-ids` | Room 可见文本和 aria-label 里的原始动作 id | `ci-budgets.json` → `launchChecklist.hudRawActionIds` | 两个视口都是 0 | **pass · 已阻断**：`HexSettlementBoard` aria-label 去掉 vertex/edge/hex 坐标键 |

状态取值：`pass` / `warn` / `fail` / `missing`（输入缺失，例如没跑 perf:ci）。

## CI 接线

- `verify.yml`：在 `pnpm perf:ci` 之后运行（`if: always()`），检查 `asset-legal`、`size-budgets`、`draw-calls`、`hud-raw-action-ids`。`GODESK_LAUNCH_GATE_BLOCK=asset-legal,hud-raw-action-ids,draw-calls`。报告写入 `perf-results/launch-checklist.json`。
- `lighthouse.yml`：在 `lhci autorun` 之后运行，只检查 `lighthouse`（保持 warn，不入 BLOCK）。
- `perf:ci` 分档采样和 HUD 扫描**不进** `ci-budgets.json` 的 `pass`。

## 本地运行

```bash
pnpm build
pnpm perf:ci --out perf-results            # 或 --room-url <已有房间>
pnpm launch:check --perf perf-results/ci-budgets.json --out launch-checklist.json
pnpm launch:check --only lighthouse --lighthouse .lighthouseci   # 跑过 lhci 之后
```

## 转阻断

开关一：全量阻断。把两个 workflow 里 `GODESK_LAUNCH_GATE: warn` 改为 `block`。任一项非 `pass`（含 `missing`）→ 退出码 1。

开关二：逐项转正（本刀已用）。`GODESK_LAUNCH_GATE_BLOCK=asset-legal,hud-raw-action-ids,draw-calls`。命令行等价 `--block <id,...>`。

剩余建议顺序：

1. ~~HUD~~ / ~~法务豁免清零~~ / ~~draw-calls~~ — 本刀已转正。
2. `size-budgets`：render3d core 余量 ≥ 2% 后加入 BLOCK（当前 207.95 / 208 KB）。
3. Lighthouse：优化 LCP / TBT 后把 `lighthouserc.json` 对应断言改为 `"error"`，再把 `lighthouse` 加入 BLOCK。
4. 最后把 `GODESK_LAUNCH_GATE` 改为 `block`。

## 维护

- 预算数据来自 `scripts/perf/budgets.mjs`（与 `docs/perf/emulation-protocol.md` 同步）。
- 原始 id 规则在 `scripts/perf/hud-raw-ids.mjs`，单测在 `scripts/launch-checklist.test.mjs`。
