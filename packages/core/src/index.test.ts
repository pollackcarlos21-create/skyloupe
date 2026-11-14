import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { version } from "./index";

test("exports a version", () => {
  expect(version).toBe("0.0.0");
});

test("has no third-party runtime dependencies", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const thirdParty = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@skyloupe/"));
  expect(thirdParty).toEqual([]);
});
