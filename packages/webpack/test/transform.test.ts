import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { applySkyloupeWebpack } from "../src/index";
import { transformModule } from "../src/transform";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the loader stamps JSX and keeps the use client directive first", () => {
  const widget = readFileSync(join(root, "fixtures/Widget.tsx"), "utf8");
  const stamped = transformModule(widget, join(root, "fixtures/Widget.tsx"), { root, dev: true });
  expect(stamped).toContain('data-skyloupe-source="fixtures/Widget.tsx:2:');
  expect(transformModule(widget, join(root, "fixtures/Widget.tsx"), { root, dev: false })).toBe(widget);

  const layout = '"use client";\nexport default function Layout(){ return <article />; }\n';
  const withSession = transformModule(layout, join(root, "fixtures/layout.tsx"), { root, dev: true });
  expect(withSession.startsWith('"use client";')).toBe(true);
  expect(withSession.indexOf("__SKYLOUPE_SESSION__")).toBeGreaterThan(withSession.indexOf("use client"));
});

test("applySkyloupeWebpack adds the loader only in development", () => {
  const config = { module: { rules: [] as unknown[] } };
  applySkyloupeWebpack(config, { dev: false, root });
  expect(config.module.rules).toHaveLength(0);
  applySkyloupeWebpack(config, { dev: true, root });
  expect(JSON.stringify(config.module.rules)).toContain("@skyloupe/webpack/loader");
});
