import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { skyloupeModule as annotatable } from "../src/Annotatable";
import { skyloupeModule as canvas } from "../src/AnnotatableCanvas";
import { skyloupeModule as container } from "../src/AnnotationContainer";
import { skyloupeModule as controls } from "../src/useAnnotationControls";
import { skyloupeModule as mode } from "../src/useAnnotationMode";
import { coreVersion, version } from "../src/index";

test("react modules load", () => {
  expect(version).toBe("0.0.0");
  expect(coreVersion).toBe("0.0.0");
  expect([container, annotatable, controls, canvas, mode]).toEqual([
    "react/AnnotationContainer",
    "react/Annotatable",
    "react/useAnnotationControls",
    "react/AnnotatableCanvas",
    "react/useAnnotationMode",
  ]);
});

test("react is a peer dependency and not a third-party runtime dependency", () => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  expect(pkg.peerDependencies?.react).toBe(">=18.0.0");
  expect(pkg.dependencies?.react).toBeUndefined();
  const thirdParty = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@skyloupe/"));
  expect(thirdParty).toEqual([]);
});
