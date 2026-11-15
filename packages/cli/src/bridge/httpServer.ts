import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodexAppServer } from "./codexAppServer";
import type { AnnotationBundle } from "./promptFormatter";
import { enqueue } from "./store";

export interface BridgeHandle {
  port: number;
  token: string;
  close(): Promise<void>;
}

export interface BridgeOptions {
  repoRoot: string;
  port?: number;
  token?: string;
  allowOrigins?: readonly string[];
  codex?: CodexAppServer;
  log?: (line: string) => void;
}

const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/;

export function tokensMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function originAllowed(origin: string | undefined, allowOrigins: readonly string[]): boolean {
  if (!origin) return false;
  return LOCAL_ORIGIN.test(origin) || allowOrigins.includes(origin);
}

export async function startBridge(options: BridgeOptions): Promise<BridgeHandle> {
  const token = options.token ?? randomBytes(32).toString("hex");
  const allowOrigins = options.allowOrigins ?? [];
  const log = options.log ?? (() => undefined);
  const clients = new Set<ServerResponse>();
  const server = createServer(async (request, response) => {
    const port = boundPort();
    const origin = header(request, "origin");
    if ((request.method ?? "GET") === "OPTIONS") {
      const reflected = reflectedOrigin(origin, allowOrigins);
      if (request.headers.host !== `127.0.0.1:${port}` || !reflected) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }
      response.writeHead(204, preflightHeaders(reflected));
      response.end();
      return;
    }
    if (!authorized(request, port, token, allowOrigins)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }
    const cors = corsHeaders(origin, allowOrigins);
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json", ...cors });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (request.method === "GET" && request.url === "/events") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        ...cors,
      });
      response.write("\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    if (request.method === "POST" && request.url === "/annotations") {
      const body = await readBody(request);
      let bundle: AnnotationBundle & { newThread?: boolean };
      try {
        bundle = JSON.parse(body) as AnnotationBundle & { newThread?: boolean };
      } catch {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8", ...cors });
        response.end("Bad Request");
        return;
      }
      const id = bundle.id ?? `ann_${randomBytes(4).toString("hex")}`;
      const imagePath = saveScreenshot(bundle.screenshotPath);
      if (bundle.newThread) options.codex?.forgetThread();
      enqueue(options.repoRoot, { id, status: "pending", bundle, imagePath });
      log(annotationLine(bundle));
      response.writeHead(202, { "content-type": "application/json", ...cors });
      response.end(JSON.stringify({ id }));
      if (options.codex) {
        const turn = await options.codex.submit(bundle, imagePath);
        publish(clients, { type: "turn", status: turn.status, turnId: turn.turnId, files: turn.files });
        if (turn.status === "completed") publish(clients, { type: "reset", id });
      } else {
        publish(clients, { type: "queued", id });
      }
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8", ...cors });
    response.end("Not Found");
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 4777, "127.0.0.1", resolve));
  const port = boundPort();
  writeSession(options.repoRoot, port, token);
  log(`✔ SkyLoupe local bridge listening on http://127.0.0.1:${port}`);
  log("✔ Pairing token written to .skyloupe/session.json (auto-injected by @skyloupe/vite)");

  function boundPort(): number {
    const address = server.address();
    return address && typeof address === "object" ? address.port : (options.port ?? 4777);
  }

  return {
    port,
    token,
    close: () =>
      new Promise((resolve, reject) => {
        for (const client of clients) client.end();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function reflectedOrigin(origin: string | undefined, allowOrigins: readonly string[]): string | undefined {
  if (!origin || !originAllowed(origin, allowOrigins)) return undefined;
  return origin;
}

function preflightHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    vary: "Origin",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-skyloupe-token",
    "access-control-max-age": "600",
  };
}

function corsHeaders(origin: string | undefined, allowOrigins: readonly string[]): Record<string, string> {
  const reflected = reflectedOrigin(origin, allowOrigins);
  if (!reflected) return {};
  return {
    "access-control-allow-origin": reflected,
    vary: "Origin",
  };
}

function authorized(request: IncomingMessage, port: number, token: string, allowOrigins: readonly string[]): boolean {
  if (request.headers.host !== `127.0.0.1:${port}`) return false;
  const origin = header(request, "origin");
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD" && !originAllowed(origin, allowOrigins)) return false;
  if (origin && !originAllowed(origin, allowOrigins)) return false;
  return tokensMatch(token, header(request, "x-skyloupe-token") ?? "");
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function publish(clients: Set<ServerResponse>, event: unknown): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(payload);
}

function writeSession(repoRoot: string, port: number, token: string): void {
  const dir = join(repoRoot, ".skyloupe");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "session.json");
  writeFileSync(file, JSON.stringify({ port, token }, null, 2), { encoding: "utf8", mode: 0o600 });
  chmodSync(file, 0o600);
}

export function saveScreenshot(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith("data:image/")) return value;
  const base64 = value.slice(value.indexOf(",") + 1);
  const dir = join(tmpdir(), "skyloupe");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `ann_${randomBytes(4).toString("hex")}.png`);
  writeFileSync(file, Buffer.from(base64, "base64"), { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

function annotationLine(bundle: AnnotationBundle): string {
  const target = bundle.target;
  const name = !target
    ? "annotation"
    : target.kind === "element"
      ? (target.annotatableName ?? target.tagName)
      : target.kind === "canvas-object"
        ? (target.objectName ?? target.objectId)
        : target.selectedText;
  return `Annotation received on <${name}>`;
}
