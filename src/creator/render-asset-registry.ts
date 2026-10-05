/**
 * GameSpec / render-spec 资产 id 许可证允许表。
 *
 * G3D-11：唯一数据源是 `src/render3d/assets/manifest.ts`（与 `assets/LICENSES.md`
 * 由 `scripts/verify-assets.mjs` 对齐）。禁止在本文件维护第二份登记表。
 *
 * `tsconfig.worker.json` 额外 include 了 `manifest.ts`（纯数据、无 three），
 * 以便 worker 侧 `render-spec` 校验可调用 `isClearedRenderAsset`。
 */
import { ASSET_MANIFEST } from "../render3d/assets/manifest";

const renderAssetLicenses: ReadonlyMap<string, { status: "cleared" | "pending" }> =
  new Map(
    ASSET_MANIFEST.map(
      (entry) => [entry.id, { status: entry.license.status }] as const,
    ),
  );

export function isClearedRenderAsset(id: string): boolean {
  return renderAssetLicenses.get(id)?.status === "cleared";
}

/** 测试与调试：cleared 条目数（与 LICENSES 对齐由 verify-assets 保证）。 */
export function clearedRenderAssetCount(): number {
  let n = 0;
  for (const v of renderAssetLicenses.values()) {
    if (v.status === "cleared") n += 1;
  }
  return n;
}
