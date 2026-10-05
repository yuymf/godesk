/**
 * 与 manifest.ts 同步的运行时数据（供 Node CI 脚本 import，无需 TS 转译）。
 * 变更 ASSET_MANIFEST 时必须同时更新本文件与 assets/LICENSES.md。
 */
export const ASSET_MANIFEST = Object.freeze([
  {
    id: "font/manrope",
    file: "src/assets/fonts/manrope-latin-wght-normal.woff2",
    kind: "font",
    bytes: 24836,
    tier: "all",
    source: "ofl",
    license: {
      spdx: "OFL-1.1",
      sourceUrl: "https://fonts.google.com/specimen/Manrope",
      author: "Mikhail Sharanda / Cyreal",
      obtainedAt: "2026-10-05",
      modified: false,
      modificationNote: "无",
      orderRef: "n/a",
      status: "cleared",
    },
  },
  {
    id: "ui/godesk-mark",
    file: "src/assets/godesk-mark.svg",
    kind: "ui",
    bytes: 533,
    tier: "all",
    source: "self-made",
    license: {
      spdx: "LicenseRef-GoDesk-Original",
      sourceUrl: "src/assets/godesk-mark.svg",
      author: "俞孟凡 / GoDesk",
      obtainedAt: "2026-10-05",
      modified: false,
      modificationNote: "无",
      orderRef: "n/a",
      status: "cleared",
    },
  },
]);
