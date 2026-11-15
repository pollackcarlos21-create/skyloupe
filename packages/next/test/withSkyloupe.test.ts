import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { transformModule } from "../../webpack/src/transform";
import { withSkyloupe } from "../src/index";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/layout.tsx");

test("withSkyloupe adds the dev loader and leaves production config alone", () => {
  const wrapped = withSkyloupe({
    webpack: (config, context) => (context.dev ? config : config),
  });
  const production = { module: { rules: [] as unknown[] } };
  wrapped.webpack?.(production, { dev: false, dir: "/app", isServer: false });
  expect(production.module.rules).toHaveLength(0);
  const development = { module: { rules: [] as unknown[] } };
  wrapped.webpack?.(development, { dev: true, dir: "/app", isServer: true });
  expect(JSON.stringify(development.module.rules)).toContain("@skyloupe/webpack/loader");
});

test("the app router fixture keeps use client before the session preamble", () => {
  const source = readFileSync(fixture, "utf8");
  const next = transformModule(source, fixture, { root: dirname(fixture), dev: true });
  expect(next.startsWith('"use client";')).toBe(true);
  expect(next).toContain("data-skyloupe-source=");
  expect(next).toContain("__SKYLOUPE_SESSION__");
});
