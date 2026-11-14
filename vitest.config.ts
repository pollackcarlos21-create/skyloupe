import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@skyloupe/schema": source("schema"),
      "@skyloupe/core": source("core"),
      "@skyloupe/dom": source("dom"),
      "@skyloupe/react": source("react"),
      "@skyloupe/cli": source("cli"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.ts"],
  },
});
