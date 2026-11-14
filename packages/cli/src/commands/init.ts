import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function initProject(repoRoot: string): string {
  const ignorePath = join(repoRoot, ".gitignore");
  const current = existsSync(ignorePath) ? readFileSync(ignorePath, "utf8") : "";
  if (!current.split("\n").some((line) => line.trim() === ".skyloupe/")) {
    writeFileSync(ignorePath, `${current.trimEnd()}\n.skyloupe/\n`, "utf8");
  }
  const vite = ["vite.config.ts", "vite.config.js", "vite.config.mjs"].some((name) => existsSync(join(repoRoot, name)));
  const next = ["next.config.ts", "next.config.js", "next.config.mjs"].some((name) => existsSync(join(repoRoot, name)));
  const kind = vite ? "Vite" : next ? "Next.js" : "a project";
  return [
    `✔ Detected ${kind} at ${repoRoot}`,
    "✔ .skyloupe/ is listed in .gitignore",
    "Add the Vite plugin and mount devtools in development:",
    "  import skyloupe from \"@skyloupe/vite\";",
    "  import { mountDevtools } from \"@skyloupe/devtools\";",
    "  if (import.meta.env.DEV) mountDevtools();",
  ].join("\n");
}
