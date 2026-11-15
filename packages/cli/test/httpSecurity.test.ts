import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { startBridge, tokensMatch } from "../src/bridge/httpServer";

const DEMO_ORIGIN = "http://127.0.0.1:5173";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

test("OPTIONS preflight from the demo origin returns 204 without a token", async () => {
  const bridge = await open();
  const response = await call(bridge, {
    method: "OPTIONS",
    path: "/health",
    origin: DEMO_ORIGIN,
    headers: {
      "access-control-request-method": "GET",
      "access-control-request-headers": "x-skyloupe-token",
    },
  });
  expect(response.status).toBe(204);
  expect(response.body).toBe("");
  expect(response.headers["access-control-allow-origin"]).toBe(DEMO_ORIGIN);
  expect(response.headers.vary).toBe("Origin");
  expect(response.headers["access-control-allow-methods"]).toBe("GET, POST, OPTIONS");
  expect(response.headers["access-control-allow-headers"]).toBe("content-type, x-skyloupe-token");
  expect(response.headers["access-control-max-age"]).toBe("600");
});

test("OPTIONS preflight from a disallowed origin or wrong Host stays 403", async () => {
  const bridge = await open();
  const denied = await call(bridge, {
    method: "OPTIONS",
    path: "/annotations",
    origin: "https://evil.example",
    token: bridge.token,
  });
  expect(denied.status).toBe(403);
  expect(denied.headers["access-control-allow-origin"]).toBeUndefined();

  const wrongHost = await call(bridge, {
    method: "OPTIONS",
    path: "/health",
    origin: DEMO_ORIGIN,
    host: "evil.example",
    token: bridge.token,
  });
  expect(wrongHost.status).toBe(403);
  expect(wrongHost.headers["access-control-allow-origin"]).toBeUndefined();
});

test("GET /health with the pairing token and an allowed origin returns CORS headers", async () => {
  const bridge = await open();
  const response = await call(bridge, { method: "GET", path: "/health", origin: DEMO_ORIGIN, token: bridge.token });
  expect(response.status).toBe(200);
  expect(JSON.parse(response.body)).toEqual({ ok: true });
  expect(response.headers["access-control-allow-origin"]).toBe(DEMO_ORIGIN);
  expect(response.headers.vary).toBe("Origin");

  const missingToken = await call(bridge, { method: "GET", path: "/health", origin: DEMO_ORIGIN });
  expect(missingToken.status).toBe(403);
  expect(missingToken.headers["access-control-allow-origin"]).toBeUndefined();
});

test("cross-origin annotations and events keep the token check and echo the allowed origin", async () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-cors-"));
  const bridge = await startBridge({ repoRoot: root, port: 0 });
  closers.push(bridge.close);
  const events = await openEvents(bridge, { origin: DEMO_ORIGIN, token: bridge.token });
  expect(events.status).toBe(200);
  expect(events.headers["content-type"]).toContain("text/event-stream");
  expect(events.headers["access-control-allow-origin"]).toBe(DEMO_ORIGIN);
  expect(events.headers.vary).toBe("Origin");

  const posted = await call(bridge, {
    method: "POST",
    path: "/annotations",
    origin: DEMO_ORIGIN,
    token: bridge.token,
    body: JSON.stringify({ comment: "room", screenshotPath: PNG }),
    headers: { "content-type": "application/json" },
  });
  expect(posted.status).toBe(202);
  expect(posted.headers["access-control-allow-origin"]).toBe(DEMO_ORIGIN);
  expect(posted.headers.vary).toBe("Origin");
  const id = (JSON.parse(posted.body) as { id: string }).id;
  const frame = await withTimeout(events.nextFrame());
  const data = frame
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6);
  expect(JSON.parse(data ?? "")).toEqual({ type: "queued", id });
  events.close();

  const queued = JSON.parse(readFileSync(join(root, ".skyloupe", "queue.json"), "utf8")) as {
    items: Array<{ bundle: { comment?: string; screenshotPath?: string }; imagePath?: string }>;
  };
  expect(queued.items[0]?.bundle.comment).toBe("room");
  expect(queued.items[0]?.bundle.screenshotPath).toBe(PNG);
  expect(queued.items[0]?.imagePath && existsSync(queued.items[0].imagePath)).toBe(true);

  const bad = await call(bridge, {
    method: "POST",
    path: "/annotations",
    origin: DEMO_ORIGIN,
    token: bridge.token,
    body: "{",
    headers: { "content-type": "application/json" },
  });
  expect(bad.status).toBe(400);
  expect(bad.headers["access-control-allow-origin"]).toBe(DEMO_ORIGIN);
  expect(bad.headers.vary).toBe("Origin");

  const missing = await call(bridge, { method: "GET", path: "/missing", origin: DEMO_ORIGIN, token: bridge.token });
  expect(missing.status).toBe(404);
  expect(missing.headers["access-control-allow-origin"]).toBe(DEMO_ORIGIN);
  expect(missing.headers.vary).toBe("Origin");
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
  return call(bridge, {
    method: "POST",
    path: "/annotations",
    origin: input.origin,
    token: input.token,
    host: input.host,
    body: input.body ?? "{}",
    headers: { "content-type": "application/json" },
  });
}

function call(
  bridge: { port: number },
  input: {
    method: string;
    path?: string;
    origin?: string;
    token?: string;
    host?: string;
    body?: string;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; body: string; headers: IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: bridge.port,
        path: input.path ?? "/health",
        method: input.method,
        headers: {
          host: input.host ?? `127.0.0.1:${bridge.port}`,
          ...(input.origin ? { origin: input.origin } : {}),
          ...(input.token ? { "x-skyloupe-token": input.token } : {}),
          ...input.headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(input.body);
  });
}

function openEvents(
  bridge: { port: number; token: string },
  input: { origin: string; token: string },
): Promise<{ status: number; headers: IncomingHttpHeaders; nextFrame: () => Promise<string>; close: () => void }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: bridge.port,
        path: "/events",
        method: "GET",
        headers: {
          host: `127.0.0.1:${bridge.port}`,
          origin: input.origin,
          "x-skyloupe-token": input.token,
        },
      },
      (response) => {
        let buffer = "";
        const waiters: Array<(frame: string) => void> = [];
        const pull = (): string | undefined => {
          const split = buffer.indexOf("\n\n");
          if (split < 0) return undefined;
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          return frame;
        };
        response.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf8");
          for (;;) {
            const waiter = waiters[0];
            if (!waiter) break;
            const frame = pull();
            if (frame === undefined) break;
            waiters.shift();
            waiter(frame);
          }
        });
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          nextFrame: () =>
            new Promise((done) => {
              const frame = pull();
              if (frame !== undefined) done(frame);
              else waiters.push(done);
            }),
          close: () => req.destroy(),
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for a bridge event")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
