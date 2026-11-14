import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { skyloupeModule } from "../src/index";

test("vite plugin module loads", () => {
  expect(skyloupeModule).toBe("vite/index");
});

test("vite is a peer dependency", () => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    peerDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  expect(pkg.peerDependencies?.vite).toBe(">=5.0.0");
  expect(pkg.dependencies?.vite).toBeUndefined();
});
