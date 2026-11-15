import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm";
export type Framework = "vite" | "next" | "webpack" | "unknown";

const PACK_ROOT = "https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs";
const VERSION = "0.2.0";

export interface InitOptions {
  run?: (command: string, args: string[], cwd: string) => void;
}

export function detectPackageManager(root: string): PackageManager {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) return "bun";
  return "npm";
}

export function detectFramework(root: string): Framework {
  if (exists(root, ["next.config.ts", "next.config.js", "next.config.mjs"])) return "next";
  if (exists(root, ["webpack.config.ts", "webpack.config.js", "webpack.config.mjs"])) return "webpack";
  if (exists(root, ["vite.config.ts", "vite.config.js", "vite.config.mjs"])) return "vite";
  return "unknown";
}

export function initProject(repoRoot: string, options: InitOptions = {}): string {
  const lines: string[] = [];
  const framework = detectFramework(repoRoot);
  const manager = detectPackageManager(repoRoot);
  lines.push(`✔ Detected ${framework === "unknown" ? "a project" : framework} using ${manager} at ${repoRoot}`);
  ensureGitignore(repoRoot);
  lines.push("✔ .skyloupe/ is listed in .gitignore");
  const script = ensureBridgeScript(repoRoot);
  lines.push(script === "added" ? "✔ Added script skyloupe:bridge" : script === "kept" ? "✔ Bridge script already present" : "✔ No package.json, skipped the bridge script");
  if (framework === "unknown") {
    lines.push("No Vite, Next.js, or webpack config was found. Install @skyloupe/devtools and mount it in development.");
    return lines.join("\n");
  }
  const run = options.run ?? defaultRun;
  const specs = packagesFor(framework).map(packSpec);
  run(manager, installArgs(manager, specs), repoRoot);
  lines.push(`✔ Installed ${packagesFor(framework).join(", ")} with ${manager}`);
  lines.push(configureFramework(repoRoot, framework));
  lines.push("Mount devtools only in development:");
  lines.push(mountSnippet(framework));
  return lines.join("\n");
}

export function patchViteConfig(source: string): { next: string; changed: boolean } {
  if (source.includes("@skyloupe/vite")) return { next: source, changed: false };
  if (!/plugins\s*:\s*\[/.test(source)) return { next: source, changed: false };
  const imported = `import skyloupe from "@skyloupe/vite";\n`;
  const matches = [...source.matchAll(/^import .+\n/gm)];
  const last = matches.at(-1);
  const withImport = last?.index === undefined
    ? `${imported}${source}`
    : `${source.slice(0, last.index + last[0].length)}${imported}${source.slice(last.index + last[0].length)}`;
  const next = withImport.replace(/plugins\s*:\s*\[/, "plugins: [skyloupe(), ");
  return { next, changed: next !== source };
}

export function viteConfigDiff(current: string): string {
  const suggestion = [
    'import skyloupe from "@skyloupe/vite";',
    "plugins: [skyloupe()],",
  ].join("\n");
  return [`--- vite.config`, `+++ vite.config`, current, suggestion].join("\n");
}

function configureFramework(root: string, framework: Framework): string {
  if (framework === "vite") {
    const file = ["vite.config.ts", "vite.config.js", "vite.config.mjs"].find((name) => existsSync(join(root, name)));
    if (!file) return "Add @skyloupe/vite to the Vite plugins list.";
    const path = join(root, file);
    const current = readFileSync(path, "utf8");
    const patched = patchViteConfig(current);
    if (patched.changed) {
      writeFileSync(path, patched.next);
      return `✔ Patched ${file}`;
    }
    if (current.includes("@skyloupe/vite")) return `✔ ${file} already includes @skyloupe/vite`;
    return `Could not safely patch ${file}. Apply this diff:\n${viteConfigDiff(current)}`;
  }
  if (framework === "next") {
    return [
      "Wrap next.config with withSkyloupe. The loader runs in development only:",
      '  import { withSkyloupe } from "@skyloupe/next";',
      "  export default withSkyloupe({});",
    ].join("\n");
  }
  return [
    "Add the webpack plugin in development:",
    '  import { applySkyloupeWebpack } from "@skyloupe/webpack";',
    "  applySkyloupeWebpack(config, { dev: true, root: __dirname });",
  ].join("\n");
}

function mountSnippet(framework: Framework): string {
  if (framework === "next") return '  if (process.env.NODE_ENV !== "production") mountDevtools();';
  return "  if (import.meta.env.DEV) mountDevtools();";
}

function packagesFor(framework: Framework): string[] {
  if (framework === "next") return ["@skyloupe/next", "@skyloupe/webpack", "@skyloupe/devtools", "@skyloupe/react", "skyloupe"];
  if (framework === "webpack") return ["@skyloupe/webpack", "@skyloupe/devtools", "@skyloupe/react", "skyloupe"];
  return ["@skyloupe/vite", "@skyloupe/devtools", "@skyloupe/react", "skyloupe"];
}

function packSpec(name: string): string {
  const file = name === "skyloupe" ? `skyloupe-${VERSION}.tgz` : `${name.slice(1).replace("/", "-")}-${VERSION}.tgz`;
  return `${PACK_ROOT}/${file}`;
}

function installArgs(manager: PackageManager, specs: string[]): string[] {
  if (manager === "pnpm") return ["add", "-D", ...specs];
  if (manager === "yarn") return ["add", "-D", ...specs];
  if (manager === "bun") return ["add", "-d", ...specs];
  return ["install", "-D", ...specs];
}

function ensureGitignore(root: string): void {
  const ignorePath = join(root, ".gitignore");
  const current = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  if (!current.split("\n").some((line) => line.trim() === ".skyloupe/")) {
    writeFileSync(ignorePath, `${current.trimEnd()}\n.skyloupe/\n`, "utf8");
  }
}

function ensureBridgeScript(root: string): "added" | "kept" | "missing" {
  const path = join(root, "package.json");
  if (!existsSync(path)) return "missing";
  const pkg = JSON.parse(readFileSync(path, "utf8")) as { scripts?: Record<string, string> };
  pkg.scripts ??= {};
  if (pkg.scripts["skyloupe:bridge"]) return "kept";
  pkg.scripts["skyloupe:bridge"] = "skyloupe bridge";
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  return "added";
}

function exists(root: string, names: string[]): boolean {
  return names.some((name) => existsSync(join(root, name)));
}

function defaultRun(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}
