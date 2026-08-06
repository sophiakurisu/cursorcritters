import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built bundle works from any static host or subpath.
  base: "./",
  build: { target: "es2022" },
});
