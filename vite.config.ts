import { defineConfig } from "vite";

const page = (name: string) => new URL(`./${name}`, import.meta.url).pathname;

export default defineConfig({
  // Relative base so the built bundle works from any static host or subpath.
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        garden: page("index.html"),
        hunt: page("hunt.html"),
        daily: page("daily.html"),
      },
    },
  },
});
