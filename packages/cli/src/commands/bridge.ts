import { CodexAppServer, openCodexSocket, spawnCodexAppServer, attachChild } from "../bridge/codexAppServer";
import { startBridge } from "../bridge/httpServer";

export interface BridgeCommandOptions {
  repoRoot: string;
  port?: number;
  allowOrigin?: string[];
  model?: string;
  codexWs?: string;
  codexBin?: string;
  log?: (line: string) => void;
}

export async function runBridge(options: BridgeCommandOptions): Promise<{ port: number; close: () => Promise<void> }> {
  const log = options.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  let codex: CodexAppServer | undefined;
  try {
    if (options.codexWs) {
      const box: { session?: CodexAppServer } = {};
      const transport = await openCodexSocket(options.codexWs, (line) => box.session?.handleLine(line));
      box.session = new CodexAppServer(transport, { cwd: options.repoRoot, model: options.model });
      codex = box.session;
    } else {
      const child = spawnCodexAppServer(options.codexBin);
      if (child.stdin) {
        codex = new CodexAppServer(
          {
            write(line: string) {
              child.stdin?.write(line);
            },
            close() {
              child.kill();
            },
          },
          { cwd: options.repoRoot, model: options.model },
        );
        attachChild(child, codex);
      }
    }
    if (codex) {
      await codex.handshake();
      log(`✔ Connected to \`codex app-server\` (cwd: ${options.repoRoot}, sandbox: workspaceWrite)`);
    }
  } catch (error) {
    log(`✔ Bridge will queue annotations; codex app-server is unavailable (${error instanceof Error ? error.message : "error"})`);
    codex = undefined;
  }
  const bridge = await startBridge({
    repoRoot: options.repoRoot,
    port: options.port,
    allowOrigins: options.allowOrigin,
    codex,
    log,
  });
  return { port: bridge.port, close: () => bridge.close() };
}
