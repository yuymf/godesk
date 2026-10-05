import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    rollupOptions: {
      output: {
        // Keep three in a render3d-* vendor chunk. Name the async SceneHost
        // facade render3d-* too so it never counts against the homepage
        // index-*.js size-limit glob.
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("/node_modules/three/")) {
            return "render3d";
          }
          return undefined;
        },
        chunkFileNames(chunkInfo) {
          const facade = chunkInfo.facadeModuleId?.replace(/\\/g, "/") ?? "";
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
    include: ["src/**/*.test.ts"],
  },
});
