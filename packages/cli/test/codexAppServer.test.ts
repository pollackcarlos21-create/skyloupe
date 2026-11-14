import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { attachChild, CodexAppServer, spawnCodexAppServer } from "../src/bridge/codexAppServer";
import { main, version } from "../src/cli";

const here = dirname(fileURLToPath(import.meta.url));

test("binary name is skyloupe", async () => {
  const lines: string[] = [];
  expect(await main(["--version"], (text) => lines.push(text))).toBe(0);
  expect(lines).toEqual([`skyloupe ${version}\n`]);
  const pkg = JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as {
    name: string;
    bin?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  expect(pkg.name).toBe("skyloupe");
  expect(pkg.bin?.skyloupe).toBe("./dist/cli.js");
  expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
    "@modelcontextprotocol/sdk",
    "@skyloupe/core",
    "commander",
    "picocolors",
    "ws",
    "zod",
  ]);
});

test("mock app-server replays initialize, initialized, thread/start, and turn/start with localImage and no jsonrpc field", async () => {
  const child = spawn(process.execPath, [join(here, "fixtures/mockAppServer.mjs")], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const session = new CodexAppServer(
    {
      write(line: string) {
        child.stdin?.write(line);
      },
      close() {
        child.kill();
      },
    },
    { cwd: "/repo" },
  );
  attachChild(child, session);
  await session.handshake();
  const turn = await session.submit(
    {
      pageUrl: "http://localhost:5173/pricing",
      viewport: { width: 1440, height: 900 },
      target: {
        kind: "element",
        annotatableName: "Pricing Card (Pro)",
        tagName: "article",
        selector: "#card",
        sourceLocation: "src/components/PricingCard.tsx:31:4",
      },
      metadata: { planId: "Pro", monthlyPrice: 29 },
      controlChanges: [
        { label: "Card padding (pixels)", reference: "--card-padding", previousValue: 20, requestedValue: 28 },
      ],
      comment: "Give the Pro card more breathing room and use our teal brand token.",
    },
    "/tmp/skyloupe/ann_1.png",
  );
  child.kill();

  const methods = session.sent.map((message) => (message as { method: string }).method);
  expect(methods).toEqual(["initialize", "initialized", "thread/start", "turn/start"]);
  expect(JSON.stringify(session.sent)).not.toContain('"jsonrpc"');
  const thread = session.sent[2] as { params: Record<string, unknown> };
  expect(thread.params).toMatchObject({
    cwd: "/repo",
    approvalPolicy: "never",
    sandbox: "workspace-write",
    serviceName: "skyloupe",
  });
  expect(thread.params).not.toHaveProperty("model");
  const started = session.sent[3] as { params: { sandboxPolicy: unknown; input: Array<{ type: string; path?: string }> } };
  expect(started.params.sandboxPolicy).toEqual({
    type: "workspaceWrite",
    networkAccess: false,
    writableRoots: ["/repo"],
  });
  expect(JSON.stringify(started.params.sandboxPolicy)).not.toContain("dangerFullAccess");
  expect(started.params.input).toContainEqual({ type: "localImage", path: "/tmp/skyloupe/ann_1.png" });
  expect(turn).toMatchObject({ threadId: "thr_123", turnId: "turn_8f1a", status: "completed", files: ["src/styles/tokens.css"] });
  expect(turn.prompt).toContain("### Target");
  expect(turn.prompt).toContain("### Instructions");
  expect(turn.prompt).toContain("TypeScript compiles");
});

const codexBin = process.env.CODEX_BIN && existsSync(process.env.CODEX_BIN)
  ? process.env.CODEX_BIN
  : spawnSync("which", ["codex"], { encoding: "utf8" }).stdout.trim();

test.skipIf(!codexBin)("initialize handshake with the local codex app-server", async () => {
  const child = spawnCodexAppServer(codexBin);
  const session = new CodexAppServer(
    {
      write(line: string) {
        child.stdin?.write(line);
      },
      close() {
        child.kill();
      },
    },
    { cwd: process.cwd() },
  );
  attachChild(child, session);
  const result = await Promise.race([
    session.handshake(),
    new Promise<Record<string, unknown>>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
  ]);
  expect(result.userAgent).toEqual(expect.any(String));
  expect(JSON.stringify(session.sent)).not.toContain('"jsonrpc"');
  child.kill();
});
