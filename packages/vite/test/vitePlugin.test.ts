import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { injectSourceAttributes, readSession, skyloupe, VIRTUAL_SESSION_ID } from "../src/index";

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("vite is a peer dependency", () => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    peerDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  expect(pkg.peerDependencies?.vite).toBe(">=5.0.0");
  expect(pkg.dependencies?.vite).toBeUndefined();
});

test("injects data-skyloupe-source on native tags and Annotatable", () => {
  const lines = Array.from({ length: 30 }, () => "");
  lines.push('   <article className="card">');
  lines.push("      <Annotatable>");
  lines.push("        <h3>Pro</h3>");
  lines.push("        <PricingCard />");
  lines.push("      </Annotatable>");
  lines.push("    </article>");
  const code = `${lines.join("\n")}\nconst sample = "<div>";\nexport function Box<T>(value: T) { return <span>{value as string}</span>; }\n`;
  const file = "src/components/PricingCard.tsx";
  const stamped = injectSourceAttributes(code, file);
  expect(stamped).toContain(`<article data-skyloupe-source="${file}:31:4"`);
  expect(stamped).toContain(`<Annotatable data-skyloupe-source="${file}:32:7"`);
  expect(stamped).toContain(`<h3 data-skyloupe-source="${file}:33:9"`);
  expect(stamped).not.toContain("PricingCard data-skyloupe-source");
  expect(stamped).not.toContain("<div data-skyloupe-source");
  expect(stamped).not.toContain("<T data-skyloupe-source");
  expect(stamped).toContain("<span data-skyloupe-source=");
  expect(injectSourceAttributes(stamped ?? "", file)).toBeNull();

  const plugin = skyloupe();
  configure(plugin, "serve", "/proj");
  const served = transform(plugin, code, "/proj/src/components/PricingCard.tsx");
  expect(served).toContain('data-skyloupe-source="src/components/PricingCard.tsx:31:4"');
  expect(transform(plugin, code, "/proj/node_modules/ui/Card.tsx")).toBeNull();
  expect(transform(plugin, code, "/proj/src/card.ts")).toBeNull();
});

test("skips source injection when Vite command is build", () => {
  const plugin = skyloupe();
  const root = tempSession({ port: 4777, token: "super-secret-token" });
  configure(plugin, "build", root);
  const code = "export const View = () => <article><Annotatable /></article>;\n";
  expect(transform(plugin, code, join(root, "src/Card.tsx"))).toBeNull();
  expect(load(plugin, resolve(plugin, VIRTUAL_SESSION_ID))).toBe("export default null\n");
  expect(html(plugin)).toBeUndefined();
  expect(injectSourceAttributes(code, "src/Card.tsx")).toContain("data-skyloupe-source");
});

test("virtual session module is null when session.json is absent", () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-missing-"));
  temps.push(root);
  expect(readSession(root)).toBeNull();
  const broken = mkdtempSync(join(tmpdir(), "skyloupe-broken-"));
  temps.push(broken);
  mkdirSync(join(broken, ".skyloupe"));
  writeFileSync(join(broken, ".skyloupe", "session.json"), "{", "utf8");
  expect(readSession(broken)).toBeNull();

  const plugin = skyloupe();
  configure(plugin, "serve", root);
  const source = load(plugin, resolve(plugin, VIRTUAL_SESSION_ID));
  expect(source).toBe("globalThis.__SKYLOUPE_SESSION__=null;export default globalThis.__SKYLOUPE_SESSION__;\n");
  const tags = html(plugin);
  expect(JSON.stringify(tags)).toContain("globalThis.__SKYLOUPE_SESSION__ = null");

  const present = tempSession({ port: 4777, token: "pair-once" });
  const dev = skyloupe();
  configure(dev, "serve", present);
  expect(load(dev, resolve(dev, VIRTUAL_SESSION_ID))).toContain('"token":"pair-once"');
  expect(JSON.stringify(html(dev))).toContain("pair-once");
});

test("readSession finds the bridge file above the Vite root and re-reads it", () => {
  const repo = mkdtempSync(join(tmpdir(), "skyloupe-walk-"));
  temps.push(repo);
  writeFileSync(join(repo, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  mkdirSync(join(repo, ".skyloupe"));
  writeFileSync(join(repo, ".skyloupe", "session.json"), JSON.stringify({ port: 4777, token: "from-root" }));
  const app = join(repo, "demo", "app");
  mkdirSync(app, { recursive: true });
  expect(readSession(app)).toEqual({ port: 4777, token: "from-root" });

  const plugin = skyloupe();
  configure(plugin, "serve", app);
  expect(load(plugin, resolveId(plugin, VIRTUAL_SESSION_ID))).toContain('"token":"from-root"');
  expect(JSON.stringify(html(plugin))).toContain("from-root");

  writeFileSync(join(repo, ".skyloupe", "session.json"), JSON.stringify({ port: 4778, token: "restarted" }));
  expect(load(plugin, resolveId(plugin, VIRTUAL_SESSION_ID))).toContain('"token":"restarted"');
  expect(JSON.stringify(html(plugin))).toContain("restarted");
  expect(JSON.stringify(html(plugin))).not.toContain("from-root");

  mkdirSync(join(app, ".skyloupe"));
  writeFileSync(join(app, ".skyloupe", "session.json"), JSON.stringify({ port: 9, token: "closer" }));
  expect(readSession(app)).toEqual({ port: 9, token: "closer" });
});

test("readSession stops at the nearest git or workspace directory", () => {
  const outer = mkdtempSync(join(tmpdir(), "skyloupe-outer-"));
  temps.push(outer);
  mkdirSync(join(outer, ".skyloupe"));
  writeFileSync(join(outer, ".skyloupe", "session.json"), JSON.stringify({ port: 1, token: "too-high" }));
  const repo = join(outer, "repo");
  const app = join(repo, "demo", "app");
  mkdirSync(app, { recursive: true });
  mkdirSync(join(repo, ".git"));
  expect(readSession(app)).toBeNull();

  writeFileSync(join(repo, "pnpm-workspace.yaml"), "packages:\n");
  mkdirSync(join(repo, ".skyloupe"));
  writeFileSync(join(repo, ".skyloupe", "session.json"), JSON.stringify({ port: 4777, token: "inclusive" }));
  expect(readSession(app)).toEqual({ port: 4777, token: "inclusive" });
});

test("the dev server re-reads the parent session on each page load and reloads when it changes", async () => {
  const repo = mkdtempSync(join(tmpdir(), "skyloupe-dev-"));
  temps.push(repo);
  const app = join(repo, "demo", "app");
  mkdirSync(app, { recursive: true });
  mkdirSync(join(repo, ".skyloupe"));
  writeFileSync(join(repo, "pnpm-workspace.yaml"), "packages:\n");
  writeFileSync(join(app, "index.html"), "<!doctype html><html><head></head><body></body></html>\n");
  const sessionFile = join(repo, ".skyloupe", "session.json");
  writeFileSync(sessionFile, JSON.stringify({ port: 4777, token: "first-token" }));

  const server = await createServer({
    configFile: false,
    root: app,
    cacheDir: join(repo, ".vite"),
    logLevel: "silent",
    plugins: [skyloupe()],
    server: {
      host: "127.0.0.1",
      port: 0,
      watch: { usePolling: true, interval: 30 },
    },
  });
  await server.listen();
  try {
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("missing dev server port");
    const page = async () => {
      const response = await fetch(`http://127.0.0.1:${address.port}/`);
      return response.text();
    };
    expect(await page()).toContain("first-token");
    const firstModule = await server.transformRequest("\0skyloupe/session");
    expect(firstModule?.code).toContain("first-token");

    const reloaded = waitForReload(server);
    writeFileSync(sessionFile, JSON.stringify({ port: 4778, token: "second-token" }));
    const html = await page();
    expect(html).toContain("second-token");
    expect(html).not.toContain("first-token");
    const secondModule = await server.transformRequest("\0skyloupe/session");
    expect(secondModule?.code).toContain("second-token");
    await reloaded;
  } finally {
    await server.close();
  }
});

function tempSession(session: { port: number; token: string }): string {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-session-"));
  temps.push(root);
  const dir = join(root, ".skyloupe");
  mkdirSync(dir);
  writeFileSync(join(dir, "session.json"), JSON.stringify(session), { encoding: "utf8" });
  return root;
}

function asFn<Args extends unknown[], Result>(hook: unknown, name: string): (...args: Args) => Result {
  if (typeof hook !== "function") throw new Error(`${name} missing`);
  return hook as (...args: Args) => Result;
}

function configure(plugin: Plugin, command: "build" | "serve", root: string) {
  asFn<[{ command: "build" | "serve"; root: string }], void>(plugin.configResolved, "configResolved")({
    command,
    root,
  });
}

function transform(plugin: Plugin, code: string, id: string) {
  return asFn<[string, string], string | null>(plugin.transform, "transform")(code, id);
}

function resolve(plugin: Plugin, id: string) {
  return asFn<[string], string | undefined>(plugin.resolveId, "resolveId")(id);
}

function load(plugin: Plugin, id: unknown) {
  return asFn<[string], string | null>(plugin.load, "load")(String(id));
}

function html(plugin: Plugin) {
  return asFn<[string], unknown>(plugin.transformIndexHtml, "transformIndexHtml")("<html></html>");
}

function resolveId(plugin: Plugin, id: string) {
  return resolve(plugin, id);
}

function waitForReload(server: ViteDevServer): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("session file change did not reload the dev server")), 4000);
    const send = server.ws.send.bind(server.ws);
    server.ws.send = ((payload: { type?: string }) => {
      if (payload?.type === "full-reload") {
        clearTimeout(timer);
        resolve();
      }
      return send(payload as Parameters<ViteDevServer["ws"]["send"]>[0]);
    }) as ViteDevServer["ws"]["send"];
  });
}
