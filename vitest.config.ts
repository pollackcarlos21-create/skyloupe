import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@skyloupe/core/validators": fileURLToPath(
        new URL("./packages/core/src/validators.ts", import.meta.url),
      ),
      "@skyloupe/core": source("core"),
      "@skyloupe/react": source("react"),
      "@skyloupe/vite": source("vite"),
      "@skyloupe/devtools": source("devtools"),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost:3000/" },
    },
    include: ["packages/*/test/**/*.test.ts", "packages/*/test/**/*.test.tsx", "playground/test/**/*.test.ts"],
  },
});
