import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { skyloupeModule } from "../src/bridge/codexAppServer";
import { main, version } from "../src/cli";

test("codex app-server module loads", () => {
  expect(skyloupeModule).toBe("cli/bridge/codexAppServer");
});

test("binary name is skyloupe", () => {
  const lines: string[] = [];
  expect(main(["--version"], (text) => lines.push(text))).toBe(0);
  expect(lines).toEqual([`skyloupe ${version}\n`]);
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    name: string;
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  expect(pkg.name).toBe("skyloupe");
  expect(pkg.bin?.skyloupe).toBe("./dist/cli.js");
  expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
    "@modelcontextprotocol/sdk",
    "commander",
    "picocolors",
    "ws",
    "zod",
  ]);
});
