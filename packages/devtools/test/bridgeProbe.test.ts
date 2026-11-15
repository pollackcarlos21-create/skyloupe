/**
 * @vitest-environment node
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { expect, test } from "vitest";
import { startBridge } from "../../cli/src/bridge/httpServer";

const root = dirname(fileURLToPath(import.meta.url));
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("probeBridge from the demo origin connects to a real bridge", async () => {
  const repo = mkdtempSync(join(tmpdir(), "skyloupe-probe-"));
  const bridge = await startBridge({ repoRoot: repo, port: 0, token: "pair-token" });
  const bundle = join(tmpdir(), `skyloupe-probe-${bridge.port}.js`);
  await build({
    entryPoints: [join(root, "../src/client/bridgeClient.ts")],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile: bundle,
  });
  const script = readFileSync(bundle);
  const session = { port: bridge.port, token: bridge.token };
  const html = `<!doctype html>
<script id="session" type="application/json">${JSON.stringify(session)}</script>
<script type="module">
  import { probeBridge, sendAnnotation } from "/probe.js";
  const session = JSON.parse(document.getElementById("session").textContent);
  let post = "ok";
  const connected = await probeBridge(session);
  try {
    await sendAnnotation(session, { comment: "from-browser", screenshotPath: ${JSON.stringify(PNG)} });
  } catch (error) {
    post = error instanceof Error ? error.message : String(error);
  }
  document.documentElement.dataset.result = JSON.stringify({ connected, post });
</script>`;
  const pageServer: Server = createServer((request, response) => {
    if (request.url?.startsWith("/probe.js")) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(script);
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise<void>((resolve) => pageServer.listen(0, "127.0.0.1", resolve));
  const pagePort = (pageServer.address() as AddressInfo).port;
  const logs: string[] = [];
  let browser: Browser | undefined;
  try {
    browser = await launchChrome();
    const page = await browser.newPage();
    page.on("pageerror", (error) => logs.push(error.message));
    page.on("console", (message) => logs.push(`${message.type()}: ${message.text()}`));
    await page.goto(`http://127.0.0.1:${pagePort}/`);
    try {
      await page.waitForFunction(() => document.documentElement.dataset.result, undefined, { timeout: 10_000 });
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)}\n${logs.join("\n")}`);
    }
    const result = JSON.parse((await page.locator(":root").getAttribute("data-result")) ?? "{}") as {
      connected: boolean;
      post: string;
    };
    expect(result, logs.join("\n")).toEqual({ connected: true, post: "ok" });
    const queued = JSON.parse(readFileSync(join(repo, ".skyloupe", "queue.json"), "utf8")) as {
      items: Array<{ bundle: { comment?: string; screenshotPath?: string } }>;
    };
    expect(queued.items[0]?.bundle.comment).toBe("from-browser");
    expect(queued.items[0]?.bundle.screenshotPath).toBe(PNG);
  } finally {
    await browser?.close();
    await bridge.close();
    await new Promise<void>((resolve, reject) => pageServer.close((error) => (error ? reject(error) : resolve())));
  }
}, 30_000);

async function launchChrome(): Promise<Browser> {
  const args = ["--no-sandbox", "--disable-dev-shm-usage"];
  try {
    return await chromium.launch({ headless: true, channel: "chrome", args });
  } catch {
    return await chromium.launch({ headless: true, args });
  }
}
