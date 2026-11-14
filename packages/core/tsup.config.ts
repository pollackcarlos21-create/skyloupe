import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/validators.ts"],
  splitting: false,
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  minify: true,
  treeshake: true,
  sourcemap: false,
  esbuildOptions(options) {
    options.legalComments = "none";
    options.treeShaking = true;
  },
});
