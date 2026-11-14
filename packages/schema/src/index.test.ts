import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { schemaVersion, version } from "./index";

test("exports a version", () => {
  expect(version).toBe("0.0.0");
  expect(schemaVersion).toBe(0);
});

test("has no runtime dependencies", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  expect(pkg.dependencies ?? {}).toEqual({});
});
