// G3D-11 (`src/render3d/assets/manifest.ts` + `assets/LICENSES.md`) wires the
// real manifest here; until then no asset id validates, so defaults use
// built-in primitives only.
const renderAssetLicenses: ReadonlyMap<string, { status: "cleared" | "pending" }> =
  new Map();

export function isClearedRenderAsset(id: string): boolean {
  return renderAssetLicenses.get(id)?.status === "cleared";
}
