import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * G3D-02：three / SceneHost → `render3d-*` chunk（≤ 210 KB gzip）。
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
          if (chunkInfo.name === "render3d" || facade.includes("/src/render3d/")) {
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
