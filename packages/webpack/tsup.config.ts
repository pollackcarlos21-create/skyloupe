import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/loader.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  minify: true,
  sourcemap: false,
  external: ["@skyloupe/vite"],
});
