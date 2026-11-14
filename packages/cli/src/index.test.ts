import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { main, version } from "./index";

test("version flag writes the version", () => {
  const lines: string[] = [];
  expect(main(["--version"], (text) => lines.push(text))).toBe(0);
  expect(lines).toEqual([`${version}\n`]);
});

test("default invocation writes the command name", () => {
  const lines: string[] = [];
  expect(main([], (text) => lines.push(text))).toBe(0);
  expect(lines).toEqual(["skyloupe\n"]);
});

test("package bin is skyloupe", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    name: string;
    bin?: Record<string, string>;
  };
  expect(pkg.name).toBe("@skyloupe/cli");
  expect(pkg.bin?.skyloupe).toBe("./dist/index.js");
});
