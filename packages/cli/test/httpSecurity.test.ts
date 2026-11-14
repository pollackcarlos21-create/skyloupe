import { request as httpRequest } from "node:http";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { startBridge, tokensMatch } from "../src/bridge/httpServer";

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

test("tokensMatch compares the full pairing token", () => {
  expect(tokensMatch("abcd", "abcd")).toBe(true);
  expect(tokensMatch("abcd", "abce")).toBe(false);
  expect(tokensMatch("abcd", "abc")).toBe(false);
  expect(tokensMatch("abcd", "")).toBe(false);
});

test("forged Origin https://evil.example returns 403", async () => {
  const bridge = await open();
  const response = await post(bridge, { origin: "https://evil.example", token: bridge.token });
  expect(response.status).toBe(403);
});

test("forged Host returns 403", async () => {
  const bridge = await open();
  const response = await post(bridge, { host: "evil.example", token: bridge.token, origin: "http://localhost:5173" });
  expect(response.status).toBe(403);
});

test("missing X-SkyLoupe-Token returns 403", async () => {
  const bridge = await open();
  const response = await post(bridge, { origin: "http://127.0.0.1:5173" });
  expect(response.status).toBe(403);
});

test("wrong X-SkyLoupe-Token returns 403", async () => {
  const bridge = await open();
  const response = await post(bridge, { origin: "http://localhost:3000", token: "not-the-token" });
  expect(response.status).toBe(403);
});

test("a paired localhost POST is accepted and the session file is private", async () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-bridge-"));
  const bridge = await startBridge({ repoRoot: root, port: 0 });
  closers.push(bridge.close);
  const response = await post(bridge, { origin: "http://localhost:5173", token: bridge.token, body: JSON.stringify({ comment: "room" }) });
  expect(response.status).toBe(202);
  const session = JSON.parse(readFileSync(join(root, ".skyloupe", "session.json"), "utf8")) as { port: number; token: string };
  expect(session).toEqual({ port: bridge.port, token: bridge.token });
  expect(bridge.token).toHaveLength(64);
  expect(statSync(join(root, ".skyloupe", "session.json")).mode & 0o777).toBe(0o600);
});

async function open() {
  const bridge = await startBridge({ repoRoot: mkdtempSync(join(tmpdir(), "skyloupe-deny-")), port: 0 });
  closers.push(bridge.close);
  return bridge;
}

function post(
  bridge: { port: number; token: string },
  input: { origin?: string; token?: string; host?: string; body?: string },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: bridge.port,
        path: "/annotations",
        method: "POST",
        headers: {
          host: input.host ?? `127.0.0.1:${bridge.port}`,
          ...(input.origin ? { origin: input.origin } : {}),
          ...(input.token ? { "x-skyloupe-token": input.token } : {}),
          "content-type": "application/json",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("error", reject);
    req.end(input.body ?? "{}");
  });
}
