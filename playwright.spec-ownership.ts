/**
 * SPEC OWNERSHIP —— 哪个 spec 归哪份 Playwright 配置。
 *
 * 为什么单独一个模块：`e2e/visual-regression-gate.spec.ts` 需要在**独占端口**（默认 8823）
 * 上跑，而默认 `playwright.config.ts` 的 `testDir: "./e2e"` 会把它一起捡走。捡走的后果不是
 * "多跑一个用例"，而是**整条默认 suite 变红**：像素门内部有端口自证
 * （`ownership.portMatches === true`），默认 config 的 baseURL 端口是 8799（或自动挑的空闲端口）
 * → 这条断言必红 → `pnpm test:e2e` 变红 → 人以为是产品坏了。
 *
 * 所以"哪个 spec 归谁"必须是**单一事实来源**，同时被三处引用：
 *   1. `playwright.config.ts`     的 `testIgnore`（默认 suite 不收它）
 *   2. `playwright.pixelgate.config.ts` 的 `testMatch`（像素门只收它）
 *   3. `scripts/ci-config-guards.test.mjs`（守卫：证明 1 和 2 真的生效，且没有 spec 被漏掉）
 *
 * 新增一个"自带端口/独立配置"的 spec 时，往 `CONFIG_OWNED_SPECS` 里加一条，两个 config 与
 * 守卫测试会一起跟着变 —— 不允许只改一处。
 */

/** 像素门 spec 的文件名（不带目录）。 */
export const PIXELGATE_SPEC = "visual-regression-gate.spec.ts";

/** 像素门 spec 的 glob（同时用于 testIgnore 与 testMatch）。 */
export const PIXELGATE_SPEC_GLOB = `**/${PIXELGATE_SPEC}`;

/**
 * 由**非默认** config 独占的 spec。默认 config 必须把它们全部排除。
 * 每一条都必须有对应的专用 config 收它（见 {@link CONFIG_OWNED_SPECS}）。
 */
export const CONFIG_OWNED_SPECS = [
  { spec: PIXELGATE_SPEC, glob: PIXELGATE_SPEC_GLOB, config: "playwright.pixelgate.config.ts" },
] as const;

/** 默认 config 的 `testIgnore`：所有自带专用 config 的 spec 都不许被默认 suite 收集。 */
export const DEFAULT_CONFIG_TEST_IGNORE: string[] = CONFIG_OWNED_SPECS.map((entry) => entry.glob);
