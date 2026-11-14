import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  minify: true,
  sourcemap: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
