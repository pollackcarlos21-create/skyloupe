import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  minify: true,
  sourcemap: false,
  external: ["react", "react/jsx-runtime", "@skyloupe/core", "@skyloupe/core/validators"],
  esbuildOptions(options) {
    if (options.define) delete options.define["process.env.NODE_ENV"];
  },
});
