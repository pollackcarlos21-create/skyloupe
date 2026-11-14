/**
 * @vitest-environment node
 */
import { createServer, type Server } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const artifacts = "/opt/cursor/artifacts";
let server: Server;
let browser: Browser;
let page: Page;
let port = 0;

beforeAll(async () => {
  mkdirSync(artifacts, { recursive: true });
  const bundle = join(tmpdir(), "skyloupe-fixture.js");
  await build({
    entryPoints: [join(root, "fixture/main.ts")],
    bundle: true,
    format: "esm",
    outfile: bundle,
    absWorkingDir: join(root, "../../.."),
    alias: {
      "@skyloupe/core/validators": join(root, "../../core/src/validators.ts"),
      "@skyloupe/core": join(root, "../../core/src/index.ts"),
    },
  });
  const html = readFileSync(join(root, "fixture/page.html"));
  const script = readFileSync(bundle);
  server = createServer((request, response) => {
    if (request.url?.startsWith("/fixture.js")) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(script);
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  port = address.port;
  browser = await launchChrome();
  page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: `http://127.0.0.1:${port}` });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.getByRole("button", { name: "Annotate" }).waitFor();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) => server?.close((error) => (error ? reject(error) : resolve())));
});

describe("polyfill-standalone simulator", () => {
  test("shows Clipboard Mode before a backend exists", async () => {
    await page.getByText("Clipboard Mode").waitFor();
  });

  test("picks a DOM element", async () => {
    await page.getByRole("button", { name: "Annotate" }).click();
    await page.getByText("Annotation Mode · Hold Space to interact with page").waitFor();
    await page.locator("#card").click();
    await page.getByRole("heading", { name: "Card appearance" }).waitFor();
    await page.getByText("src/components/PricingCard.tsx:31:4").waitFor();
  });

  test("drags a slider and shows the live preview", async () => {
    await page.getByRole("slider", { name: "Card padding" }).fill("28");
    await expect.poll(() => padding()).toBe("28px");
  });

  test("holds compare and restores the original", async () => {
    const compare = page.getByRole("button", { name: "Hold to compare" });
    await compare.dispatchEvent("pointerdown");
    await expect.poll(() => padding()).toBe("");
    await compare.dispatchEvent("pointerup");
    await expect.poll(() => padding()).toBe("28px");
    await page.screenshot({ path: join(artifacts, "m3-panel.png") });
  });

  test("picks a canvas bar", async () => {
    await page.locator("#chart").click({ position: { x: 45, y: 60 } });
    await page.getByRole("heading", { name: "Q3" }).waitFor();
    await page.screenshot({ path: join(artifacts, "m3-canvas.png") });
  });

  test("shows violation warnings in the drawer", async () => {
    await page.getByRole("button", { name: /Spec Issues/ }).click();
    await page.getByText("OAI-META-001").waitFor();
    await page.getByText("OAI-DOM-001").waitFor();
    await page.screenshot({ path: join(artifacts, "m3-drawer.png") });
  });

  test("copies structured Markdown", async () => {
    await page.locator("#card").click();
    await page.getByRole("slider", { name: "Card padding" }).fill("32");
    await page.getByLabel("Comment").fill("Give the Pro card more breathing room.");
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("### Target");
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain("Pricing Card (Pro)");
    expect(markdown).toContain("PricingCard.tsx:31:4");
    expect(markdown).toContain("### Requested Control & Token Changes");
    expect(markdown).toContain("Card padding");
    expect(markdown).toContain("--card-padding");
    expect(markdown).toContain("32");
    expect(markdown).toContain("### User Comment");
    expect(markdown).toContain("Give the Pro card more breathing room.");
    expect(markdown).toContain("### Instructions");
    expect(markdown).toContain("TypeScript compiles");
  });
});

function padding(): Promise<string> {
  return page.locator("#card").evaluate((element) => (element as HTMLElement).style.getPropertyValue("--card-padding"));
}

async function launchChrome(): Promise<Browser> {
  const args = ["--no-sandbox", "--disable-dev-shm-usage"];
  try {
    return await chromium.launch({ headless: true, channel: "chrome", args });
  } catch {
    return await chromium.launch({ headless: true, args });
  }
}
