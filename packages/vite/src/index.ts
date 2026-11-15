import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { dirname, join, parse, relative, resolve } from "node:path";
import type { HtmlTagDescriptor, Plugin, ViteDevServer } from "vite";

export const VIRTUAL_SESSION_ID = "virtual:skyloupe/session";
const RESOLVED_SESSION_ID = "\0skyloupe/session";

export interface SkyLoupeSession {
  port: number;
  token: string;
}

export function readSession(root: string): SkyLoupeSession | null {
  for (const dir of sessionSearchDirs(root)) {
    const file = join(dir, ".skyloupe", "session.json");
    if (!existsSync(file)) continue;
    return parseSession(file);
  }
  return null;
}

function parseSession(file: string): SkyLoupeSession | null {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { port?: unknown; token?: unknown };
    if (typeof parsed.port !== "number" || !Number.isFinite(parsed.port)) return null;
    if (typeof parsed.token !== "string" || parsed.token.length === 0) return null;
    return { port: parsed.port, token: parsed.token };
  } catch {
    return null;
  }
}

function sessionSearchDirs(root: string): string[] {
  const dirs: string[] = [];
  let dir = resolve(root);
  const filesystemRoot = parse(dir).root;
  for (;;) {
    dirs.push(dir);
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, "pnpm-workspace.yaml"))) break;
    if (dir === filesystemRoot) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirs;
}

function sessionFileInSearch(root: string, file: string): boolean {
  const resolved = resolve(file);
  return sessionSearchDirs(root).some((dir) => resolve(dir, ".skyloupe", "session.json") === resolved);
}

export function sessionModuleSource(session: SkyLoupeSession | null): string {
  const json = JSON.stringify(session);
  return `globalThis.__SKYLOUPE_SESSION__=${json};export default globalThis.__SKYLOUPE_SESSION__;\n`;
}

export function injectSourceAttributes(code: string, file: string): string | null {
  let out = "";
  let i = 0;
  let line = 1;
  let col = 1;
  let changed = false;
  let quote: '"' | "'" | "`" | null = null;

  const bump = (text: string) => {
    for (const ch of text) {
      if (ch === "\n") {
        line += 1;
        col = 1;
      } else col += 1;
    }
  };
  const copy = (text: string) => {
    out += text;
    bump(text);
  };

  while (i < code.length) {
    const ch = code[i]!;
    const next = code[i + 1];
    if (quote) {
      copy(ch);
      i += 1;
      if (ch === "\\" && i < code.length) {
        copy(code[i]!);
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      copy(ch);
      i += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") {
        copy(code[i]!);
        i += 1;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      copy("/*");
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        copy(code[i]!);
        i += 1;
      }
      if (i < code.length) {
        copy("*/");
        i += 2;
      }
      continue;
    }
    if (ch === "<" && next && /[A-Za-z]/.test(next) && tagAllowed(code, i)) {
      const name = readName(code, i + 1);
      const after = i + 1 + name.length;
      if (name && shouldStamp(name) && !nameContinues(code, after) && !hasSource(code, i)) {
        out += `<${name} data-skyloupe-source="${file}:${line}:${col}"`;
        bump(`<${name}`);
        i = after;
        changed = true;
        continue;
      }
    }
    copy(ch);
    i += 1;
  }
  return changed ? out : null;
}

function tagAllowed(code: string, index: number): boolean {
  const prev = index === 0 ? "" : code[index - 1]!;
  return !/[A-Za-z0-9_$.]/.test(prev);
}

function readName(code: string, index: number): string {
  let end = index;
  while (end < code.length && /[A-Za-z0-9-]/.test(code[end]!)) end += 1;
  return code.slice(index, end);
}

function nameContinues(code: string, index: number): boolean {
  const ch = code[index];
  return ch === "." || ch === ",";
}

function shouldStamp(name: string): boolean {
  return name === "Annotatable" || name[0] === name[0]?.toLowerCase();
}

function hasSource(code: string, index: number): boolean {
  let quote: string | null = null;
  for (let i = index; i < code.length; i += 1) {
    const ch = code[i]!;
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === ">") return false;
    if (code.startsWith("data-skyloupe-source", i)) return true;
  }
  return false;
}

function watchSession(server: ViteDevServer, getRoot: () => string): void {
  const known = new Set<string>();
  const directoryWatches: FSWatcher[] = [];
  const reload = (file: string) => {
    if (!sessionFileInSearch(getRoot(), file)) return;
    const mod = server.moduleGraph.getModuleById(RESOLVED_SESSION_ID);
    if (mod) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: "full-reload" });
  };
  const onAdd = (file: string) => {
    const resolved = resolve(file);
    if (known.has(resolved)) return;
    if (!sessionFileInSearch(getRoot(), file)) return;
    known.add(resolved);
    reload(file);
  };
  const onChange = (file: string) => {
    reload(file);
  };
  const onUnlink = (file: string) => {
    known.delete(resolve(file));
    reload(file);
  };
  server.watcher.on("add", onAdd);
  server.watcher.on("change", onChange);
  server.watcher.on("unlink", onUnlink);
  for (const dir of sessionSearchDirs(getRoot())) {
    if (dir === parse(dir).root) continue;
    const folder = join(dir, ".skyloupe");
    const file = join(folder, "session.json");
    if (existsSync(file)) known.add(resolve(file));
    if (existsSync(folder)) {
      server.watcher.add(folder);
      continue;
    }
    try {
      directoryWatches.push(
        watch(dir, { persistent: true }, (_event, filename) => {
          if (filename !== ".skyloupe" || !existsSync(folder)) return;
          server.watcher.add(folder);
        }),
      );
    } catch {
      // A parent the process cannot watch still participates in the page-load read.
    }
  }
  server.httpServer?.once("close", () => {
    server.watcher.off("add", onAdd);
    server.watcher.off("change", onChange);
    server.watcher.off("unlink", onUnlink);
    for (const directoryWatch of directoryWatches) directoryWatch.close();
  });
}

export function skyloupe(): Plugin {
  let command: "build" | "serve" = "serve";
  let root = ".";
  let devServer: ViteDevServer | undefined;
  return {
    name: "skyloupe",
    enforce: "pre",
    configResolved(config) {
      command = config.command;
      root = config.root;
    },
    configureServer(server) {
      devServer = server;
      watchSession(server, () => root);
    },
    resolveId(id) {
      if (id === VIRTUAL_SESSION_ID) return RESOLVED_SESSION_ID;
    },
    load(id) {
      if (id !== RESOLVED_SESSION_ID) return null;
      if (command === "build") return "export default null\n";
      return sessionModuleSource(readSession(root));
    },
    transform(code, id) {
      if (command === "build") return null;
      const file = id.split("?")[0] ?? id;
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return null;
      if (file.includes("/node_modules/") || file.includes("\\node_modules\\")) return null;
      const rel = relative(root, file).split("\\").join("/");
      if (rel.startsWith("..")) return null;
      return injectSourceAttributes(code, rel);
    },
    transformIndexHtml() {
      if (command === "build") return;
      const mod = devServer?.moduleGraph.getModuleById(RESOLVED_SESSION_ID);
      if (devServer && mod) devServer.moduleGraph.invalidateModule(mod);
      const tags: HtmlTagDescriptor[] = [
        {
          tag: "script",
          attrs: { type: "module" },
          children: `globalThis.__SKYLOUPE_SESSION__ = ${JSON.stringify(readSession(root))};`,
          injectTo: "head-prepend",
        },
      ];
      return tags;
    },
  };
}

export default skyloupe;
