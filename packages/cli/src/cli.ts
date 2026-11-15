import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { runBridge } from "./commands/bridge";
import { findRepoRoot, runOfflineDemo, startDemoServer } from "./commands/demo";
import { runDoctor } from "./commands/doctor";
import { initProject } from "./commands/init";
import { runMcp } from "./commands/mcp";

export const version = "0.2.0" as const;

export async function main(
  argv: readonly string[],
  write: (text: string) => void = (text) => {
    process.stdout.write(text);
  },
): Promise<number> {
  if (argv.includes("--version") || argv.includes("-V")) {
    write(`skyloupe ${version}\n`);
    return 0;
  }
  const program = new Command();
  program.name("skyloupe").exitOverride();
  program.command("init").action(() => {
    write(`${initProject(process.cwd())}\n`);
  });
  program
    .command("bridge")
    .option("--port <port>", "loopback port", "4777")
    .option("--allow-origin <origin>", "extra browser origin", collect, [])
    .option("--model <model>", "optional Codex model override")
    .option("--codex-ws <url>", "connect to a running app-server websocket")
    .action(async (opts: { port: string; allowOrigin: string[]; model?: string; codexWs?: string }) => {
      await runBridge({
        repoRoot: process.cwd(),
        port: Number(opts.port),
        allowOrigin: opts.allowOrigin,
        model: opts.model,
        codexWs: opts.codexWs,
        log: (line) => write(`${line}\n`),
      });
    });
  program.command("mcp").action(async () => {
    await runMcp(process.cwd());
  });
  program
    .command("doctor")
    .argument("[path]", "directory to scan", ".")
    .action((path: string) => {
      const report = runDoctor(path);
      write(`${report.text}\n`);
      if (report.code !== 0) throw new Error("doctor found errors");
    });
  program
    .command("demo")
    .option("--offline", "replay the recorded edit and HMR loop, then exit")
    .option("--port <port>", "loopback port")
    .action(async (opts: { offline?: boolean; port?: string }) => {
      const repoRoot = findRepoRoot();
      if (opts.offline) {
        const result = await runOfflineDemo(repoRoot);
        write(result.log);
        return;
      }
      const demo = await startDemoServer(repoRoot, opts.port ? Number(opts.port) : 5173);
      write(`✔ SkyLoupe demo on ${demo.url}\n`);
      write("Press Ctrl+C to stop.\n");
      await new Promise<void>((resolve) => {
        process.once("SIGINT", () => resolve());
        process.once("SIGTERM", () => resolve());
      });
      await demo.close();
    });
  try {
    await program.parseAsync([...argv], { from: "user" });
    return 0;
  } catch (error) {
    const code = (error as { exitCode?: number }).exitCode;
    if (typeof code === "number") return code;
    return 1;
  }
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
