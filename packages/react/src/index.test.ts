import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { coreVersion, version } from "./index";

test("re-exports the core version", () => {
  expect(version).toBe("0.0.0");
  expect(coreVersion).toBe("0.0.0");
});

test("react is a peer dependency and not a runtime dependency", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  expect(pkg.peerDependencies?.react).toBeTruthy();
  expect(pkg.dependencies?.react).toBeUndefined();
  const thirdParty = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@skyloupe/"));
  expect(thirdParty).toEqual([]);
});
