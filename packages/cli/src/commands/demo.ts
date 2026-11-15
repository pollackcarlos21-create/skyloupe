import { request } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";

export interface DemoServer {
  url: string;
  port: number;
  server: ViteDevServer;
  close(): Promise<void>;
}

export interface OfflineReplayResult {
  url: string;
  log: string;
}

interface RecordedTurn {
  comment: string;
  durationMs: number;
  file: string;
  replacements: Array<{ from: string; to: string }>;
  expect: string[];
}

export function findRepoRoot(start = dirname(fileURLToPath(import.meta.url))): string {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    try {
      readFileSync(join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("SkyLoupe workspace root not found");
}

export async function startDemoServer(repoRoot: string, port = 5173): Promise<DemoServer> {
  const server = await createViteServer({
    configFile: join(repoRoot, "demo/app/vite.config.ts"),
    root: join(repoRoot, "demo/app"),
    server: { host: "127.0.0.1", port, strictPort: port !== 0 },
    logLevel: "silent",
  });
  await server.listen();
  const address = server.httpServer?.address();
  const bound = address && typeof address === "object" ? address.port : port;
  return {
    url: `http://127.0.0.1:${bound}/`,
    port: bound,
    server,
    close: () => server.close(),
  };
}

export async function runOfflineDemo(repoRoot = findRepoRoot()): Promise<OfflineReplayResult> {
  const recorded = JSON.parse(readFileSync(join(repoRoot, "demo/recorded-codex/turn.json"), "utf8")) as RecordedTurn;
  const target = join(repoRoot, "demo/app", recorded.file);
  const original = readFileSync(target, "utf8");
  const demo = await startDemoServer(repoRoot, 0);
  try {
    let next = original;
    for (const replacement of recorded.replacements) {
      if (!next.includes(replacement.from)) throw new Error(`recorded snippet missing: ${replacement.from}`);
      next = next.replace(replacement.from, replacement.to);
    }
    writeFileSync(target, next, "utf8");
    const modules = demo.server.moduleGraph.getModulesByFile(target);
    if (modules) for (const mod of modules) demo.server.moduleGraph.invalidateModule(mod);
    const served = await getText(`${demo.url}${recorded.file}`);
    for (const snippet of recorded.expect) {
      if (!served.includes(snippet)) throw new Error(`HMR module missing ${snippet}`);
    }
    const page = await getText(`${demo.url}src/App.tsx`);
    if (!page.includes("Pricing that can be annotated")) throw new Error("demo page did not start");
    if (!page.includes("Legacy note") || !page.includes("Launch badge")) throw new Error("planted issues missing");
    const seconds = (recorded.durationMs / 1000).toFixed(1);
    const lines = [
      `✔ SkyLoupe demo (offline) on ${demo.url}`,
      "✔ Loaded recorded turn from demo/recorded-codex/turn.json",
      `  Comment: "${recorded.comment}"`,
      "  Q3 Revenue highlight recorded",
      `  Codex editing ${recorded.file}... Done (${seconds}s)`,
      "✔ HMR served the updated accent #0f766e and radius 20px",
      "✔ Replay complete. No Codex CLI and no network.",
    ];
    return { url: demo.url, log: `${lines.join("\n")}\n` };
  } finally {
    writeFileSync(target, original, "utf8");
    await demo.close();
  }
}

function getText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(url, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("error", reject);
    req.end();
  });
}
