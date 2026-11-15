import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

test("the release doc names the GitHub dist install and the core tarball", () => {
  const doc = readFileSync(join(import.meta.dirname, "../../../docs/RELEASING.md"), "utf8");
  expect(doc).toContain("npm i github:pollackcarlos21-create/skyloupe#dist");
  expect(doc).toContain("skyloupe-core-0.2.0.tgz");
  expect(doc).toContain("npx jsr publish");
});

test("stageDist writes a GitHub install layout and tarballs", () => {
  const out = mkdtempSync(join(tmpdir(), "skyloupe-dist-"));
  execFileSync("node", ["scripts/publish-dist.mjs", "--out", out], { cwd: join(import.meta.dirname, "../../..") });
  const root = JSON.parse(readFileSync(join(out, "package.json"), "utf8")) as { name: string; bin: { skyloupe: string }; dependencies: Record<string, string> };
  expect(root.name).toBe("skyloupe");
  expect(root.bin.skyloupe).toBe("packages/cli/dist/cli.js");
  expect(root.dependencies["@skyloupe/core"]).toBe("file:packages/core");
  expect(existsSync(join(out, "packages/core/dist/index.js"))).toBe(true);
  const core = JSON.parse(readFileSync(join(out, "packages/core/package.json"), "utf8")) as { private?: boolean; version: string };
  expect(core.private).toBeUndefined();
  expect(core.version).toBe("0.2.0");
  const react = JSON.parse(readFileSync(join(out, "packages/react/package.json"), "utf8")) as { dependencies: Record<string, string> };
  expect(react.dependencies["@skyloupe/core"]).toBe("file:../core");
  expect(existsSync(join(out, "packs/skyloupe-core-0.2.0.tgz"))).toBe(true);
  expect(existsSync(join(out, "packs/skyloupe-0.2.0.tgz"))).toBe(true);
});
