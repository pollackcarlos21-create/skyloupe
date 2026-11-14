import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { version } from "../src/index";
import { skyloupeModule } from "../src/validators";

test("core/validators module loads", () => {
  expect(skyloupeModule).toBe("core/validators");
  expect(version).toBe("0.0.0");
});

test("core has no runtime dependencies", () => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  expect(pkg.dependencies ?? {}).toEqual({});
});
