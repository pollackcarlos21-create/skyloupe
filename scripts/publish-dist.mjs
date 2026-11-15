import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const GITHUB_REPO = "pollackcarlos21-create/skyloupe";

export const DIST_PACKAGES = [
  { dir: "packages/core", name: "@skyloupe/core" },
  { dir: "packages/react", name: "@skyloupe/react" },
  { dir: "packages/vite", name: "@skyloupe/vite" },
  { dir: "packages/devtools", name: "@skyloupe/devtools" },
  { dir: "packages/cli", name: "skyloupe" },
];

export function packFileName(name, version) {
  const base = name.startsWith("@") ? name.slice(1).replace("/", "-") : name;
  return `${base}-${version}.tgz`;
}

export function rawPackUrl(fileName) {
  return `https://raw.githubusercontent.com/${GITHUB_REPO}/dist/packs/${fileName}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function workspaceDeps(pkg, version, style) {
  const next = { ...pkg };
  delete next.private;
  delete next.scripts;
  next.version = version;
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    const block = next[field];
    if (!block) continue;
    const rewritten = { ...block };
    for (const [key, value] of Object.entries(block)) {
      if (value !== "workspace:*") continue;
      const match = DIST_PACKAGES.find((item) => item.name === key);
      if (!match) continue;
      const file = packFileName(key, version);
      rewritten[key] = style === "file" ? `file:../${match.dir.split("/").pop()}` : rawPackUrl(file);
    }
    next[field] = rewritten;
  }
  return next;
}

function copyPackage(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(sourceDir, "dist"), join(targetDir, "dist"), { recursive: true });
  for (const name of ["README.md", "LICENSE"]) {
    const from = join(sourceDir, name);
    try {
      cpSync(from, join(targetDir, name));
    } catch {
      cpSync(join(repoRoot, "LICENSE"), join(targetDir, "LICENSE"));
    }
  }
}

export function stageDist(outDir, root = repoRoot) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "packs"), { recursive: true });
  const versions = new Map();
  for (const item of DIST_PACKAGES) {
    const source = join(root, item.dir);
    const pkg = readJson(join(source, "package.json"));
    if (!pkg.version) throw new Error(`${item.name} is missing a version`);
    versions.set(item.name, pkg.version);
    const target = join(outDir, "packages", item.dir.split("/").pop());
    copyPackage(source, target);
    writeFileSync(join(target, "package.json"), `${JSON.stringify(workspaceDeps(pkg, pkg.version, "file"), null, 2)}\n`);
    const packDir = join(outDir, ".pack", item.dir.split("/").pop());
    copyPackage(source, packDir);
    writeFileSync(join(packDir, "package.json"), `${JSON.stringify(workspaceDeps(pkg, pkg.version, "url"), null, 2)}\n`);
    execFileSync("npm", ["pack", "--pack-destination", join(outDir, "packs")], { cwd: packDir, stdio: "inherit" });
  }
  const cli = versions.get("skyloupe");
  const rootPkg = {
    name: "skyloupe",
    version: cli,
    description: "SkyLoupe CLI and libraries, built for install from GitHub.",
    license: "MIT",
    bin: { skyloupe: "packages/cli/dist/cli.js" },
    repository: { type: "git", url: `git+https://github.com/${GITHUB_REPO}.git` },
    dependencies: Object.fromEntries(
      DIST_PACKAGES.filter((item) => item.name !== "skyloupe").map((item) => [item.name, `file:packages/${item.dir.split("/").pop()}`]),
    ),
  };
  const cliPkg = readJson(join(root, "packages/cli/package.json"));
  for (const [key, value] of Object.entries(cliPkg.dependencies ?? {})) {
    if (value === "workspace:*") continue;
    rootPkg.dependencies[key] = value;
  }
  writeFileSync(join(outDir, "package.json"), `${JSON.stringify(rootPkg, null, 2)}\n`);
  writeFileSync(join(outDir, "README.md"), distReadme(cli));
  cpSync(join(root, "LICENSE"), join(outDir, "LICENSE"));
  return { version: cli, outDir };
}

function distReadme(version) {
  const packs = DIST_PACKAGES.map((item) => `- \`${rawPackUrl(packFileName(item.name, version))}\``).join("\n");
  return `# SkyLoupe ${version}\n\nInstall from this branch:\n\n\`\`\`bash\nnpm i github:${GITHUB_REPO}#dist\n\`\`\`\n\nOr install one tarball:\n\n${packs}\n`;
}

const outFlag = process.argv.indexOf("--out");
if (outFlag !== -1 && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[outFlag + 1];
  if (!out) throw new Error("--out requires a directory");
  stageDist(out);
}
