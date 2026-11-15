import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { detectFramework, detectPackageManager, initProject, patchViteConfig } from "../src/commands/init";

test("init installs Vite packages, patches a safe config, and adds the bridge script", () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-vite-"));
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: 9\n");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", scripts: {} }));
  writeFileSync(join(root, "vite.config.ts"), 'import react from "@vitejs/plugin-react";\nexport default { plugins: [react()] };\n');
  const calls: string[][] = [];
  const text = initProject(root, { run: (command, args) => calls.push([command, ...args]) });
  expect(detectFramework(root)).toBe("vite");
  expect(detectPackageManager(root)).toBe("pnpm");
  expect(text).toContain("✔ Patched vite.config.ts");
  expect(readFileSync(join(root, "vite.config.ts"), "utf8")).toContain("skyloupe()");
  expect(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts["skyloupe:bridge"]).toBe("skyloupe bridge");
  expect(calls[0]?.[0]).toBe("pnpm");
  expect(calls[0]?.join(" ")).toContain("skyloupe-vite-0.2.0.tgz");
  expect(readFileSync(join(root, ".gitignore"), "utf8")).toContain(".skyloupe/");
});

test("init prints a diff instead of rewriting an unsafe Vite config", () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-unsafe-"));
  writeFileSync(join(root, "package.json"), "{}\n");
  writeFileSync(join(root, "package-lock.json"), "{}\n");
  const original = "export default { plugins: react() };\n";
  writeFileSync(join(root, "vite.config.ts"), original);
  const text = initProject(root, { run: () => undefined });
  expect(text).toContain("Could not safely patch");
  expect(text).toContain('import skyloupe from "@skyloupe/vite";');
  expect(readFileSync(join(root, "vite.config.ts"), "utf8")).toBe(original);
  expect(patchViteConfig(original).changed).toBe(false);
});

test("init detects Next.js and webpack without patching a vite file", () => {
  const next = mkdtempSync(join(tmpdir(), "skyloupe-next-"));
  writeFileSync(join(next, "yarn.lock"), "");
  writeFileSync(join(next, "package.json"), "{}\n");
  writeFileSync(join(next, "next.config.ts"), "export default {};\n");
  const calls: string[] = [];
  const text = initProject(next, { run: (command) => calls.push(command) });
  expect(detectFramework(next)).toBe("next");
  expect(detectPackageManager(next)).toBe("yarn");
  expect(text).toContain("withSkyloupe");
  expect(calls).toEqual(["yarn"]);

  const webpack = mkdtempSync(join(tmpdir(), "skyloupe-webpack-"));
  writeFileSync(join(webpack, "bun.lock"), "");
  writeFileSync(join(webpack, "package.json"), "{}\n");
  writeFileSync(join(webpack, "webpack.config.js"), "module.exports = {};\n");
  const bun = initProject(webpack, { run: () => undefined });
  expect(detectPackageManager(webpack)).toBe("bun");
  expect(bun).toContain("applySkyloupeWebpack");
});
