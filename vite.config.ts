import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * G3D-02：three / SceneHost → `render3d-*` chunk（≤ 210 KB gzip）。
 * G3D-14：通用桌面 mapper 与网格工厂随 creator 侧 TabletopScene3D 懒加载，不计入核心。
 * G3D-11：GLTF/KTX2/meshopt 加载器 → `render3d-assets-*`（≤ 60 KB gzip）。
 * G3D-08：水体 shader → `tide-water-*`（懒加载，不计入 render3d core 210 KB）。
 * Basis 转码器经 import.meta.url 产出独立文件，不计入 60 KB。
 * 首页：Vite 预加载 helper 与纯数据资产清单各自成小 chunk（`vite-preload-*` / `asset-manifest-*`），
 * 否则 Rollup 会把它们并进 tide-water / render3d-assets，首页入口因此静态拉起整份 three（#138 Lighthouse）。
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
          // Keep the homepage entry free of three: these two are needed on every route.
          if (normalized.includes("vite/preload-helper")) return "vite-preload";
          if (normalized.endsWith("/src/render3d/assets/manifest.ts")) return "asset-manifest";
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
          if (normalized.includes("/src/render3d/water/")) {
            return "tide-water";
          }
          if (normalized.includes("/node_modules/three/")) {
            return "render3d";
          }
          return undefined;
        },
        chunkFileNames(chunkInfo) {
          const facade = chunkInfo.facadeModuleId?.replace(/\\/g, "/") ?? "";
          if (chunkInfo.name === "vite-preload" || chunkInfo.name === "asset-manifest") {
            return "assets/[name]-[hash].js";
          }
          if (chunkInfo.name === "render3d-assets") {
            return "assets/render3d-assets-[hash].js";
          }
          // G3D-08：水体必须先于 render3d 命名，避免被算进 210 KB 核心。
          if (chunkInfo.name === "tide-water" || facade.includes("/src/render3d/water/")) {
            return "assets/tide-water-[hash].js";
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
          // After tide-water split, a shared async chunk may inherit name "index".
          // Keep the real homepage entry as index-*; only rehome render3d-only shares.
          if (chunkInfo.name === "index") {
            const mods = (chunkInfo.moduleIds ?? []).map((id) => id.replace(/\\/g, "/"));
            const appLike = mods.some(
              (m) =>
                m.includes("/src/creator/") ||
                m.includes("/src/room/") ||
                m.includes("/src/App") ||
                m.includes("node_modules/react") ||
                m.includes("/src/main"),
            );
            if (
              !appLike &&
              mods.some((m) => m.includes("/src/render3d/") || m.includes("/node_modules/three/"))
            ) {
              return "assets/render3d-[hash].js";
            }
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
