import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * G3D-02：three / SceneHost → `render3d-*` chunk（≤ 210 KB gzip）。
 * G3D-14：通用桌面 mapper 与网格工厂随 creator 侧 TabletopScene3D 懒加载，不计入核心。
 * G3D-11：GLTF/KTX2/meshopt 加载器 → `render3d-assets-*`（≤ 60 KB gzip）。
 * Basis 转码器经 import.meta.url 产出独立文件，不计入 60 KB。
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        main: "index.html",
        "render3d-assets": "src/render3d/assets/chunk-entry.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "render3d-assets"
            ? "assets/render3d-assets-[hash].js"
            : "assets/[name]-[hash].js",
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (
            normalized.includes("/src/render3d/assets/") ||
            normalized.includes("/examples/jsm/loaders/GLTFLoader") ||
            normalized.includes("/examples/jsm/loaders/KTX2Loader") ||
            normalized.includes("/examples/jsm/libs/meshopt_decoder") ||
            normalized.includes("/examples/jsm/loaders/") ||
            normalized.includes("/examples/jsm/utils/")
          ) {
            return "render3d-assets";
          }
          if (normalized.includes("/node_modules/three/")) {
            return "render3d";
          }
          return undefined;
        },
        chunkFileNames(chunkInfo) {
          const facade = chunkInfo.facadeModuleId?.replace(/\\/g, "/") ?? "";
          if (chunkInfo.name === "render3d-assets") {
            return "assets/render3d-assets-[hash].js";
          }
          // G3D-14：SceneHost 被 hex 盘与通用桌面（TabletopScene3D）共享后成为无 facade 的共享 chunk，
          // 按内容判定：只含 src/render3d、three 与 tween 模块的 chunk 计入 render3d 核心预算。
          const render3dOnly =
            chunkInfo.moduleIds.length > 0 &&
            chunkInfo.moduleIds.every((id) => {
              const normalized = id.replace(/\\/g, "/");
              return (
                normalized.includes("/src/render3d/") ||
                normalized.includes("/node_modules/three/") ||
                normalized.includes("/node_modules/@tweenjs/")
              );
            });
          if (chunkInfo.name === "render3d" || facade.includes("/src/render3d/") || render3dOnly) {
            return "assets/render3d-[hash].js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
