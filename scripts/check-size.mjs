import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORE_LIMIT = 2048;
const COMBINED_LIMIT = 4096;

function measure(rel) {
  const file = join(root, rel);
  if (!existsSync(file)) {
    console.error(`missing ${rel}; run pnpm build first`);
    process.exit(1);
  }
  const raw = readFileSync(file);
  return { file, raw: raw.length, gzip: gzipSync(raw).length };
}

function importsWithoutDom(file) {
  const href = pathToFileURL(file).href;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(href)})`],
    { encoding: "utf8" },
  );
  return result.status === 0;
}

const core = measure("packages/core/dist/index.js");
const react = measure("packages/react/dist/index.js");
const validators = measure("packages/core/dist/validators.js");
const combined = core.gzip + react.gzip;
const coreImports = importsWithoutDom(core.file);
const reactImports = importsWithoutDom(react.file);
const validatorImports = importsWithoutDom(validators.file);
const coreOk = core.gzip < CORE_LIMIT && coreImports;
const combinedOk = combined < COMBINED_LIMIT;
const reactOk = reactImports;

const rows = [
  ["@skyloupe/core", core.raw, core.gzip, `<${CORE_LIMIT}`, coreOk ? "ok" : "FAIL"],
  ["@skyloupe/react", react.raw, react.gzip, "included in sum", reactOk ? "ok" : "FAIL"],
  ["core+react", "-", combined, `<${COMBINED_LIMIT}`, combinedOk ? "ok" : "FAIL"],
  ["@skyloupe/core/validators", validators.raw, validators.gzip, "info", validatorImports ? "info" : "FAIL"],
];
const header = ["entry", "raw", "gzip", "limit", "status"];
const widths = header.map((label, index) =>
  Math.max(label.length, ...rows.map((row) => String(row[index]).length)),
);
const format = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join("  ");
console.log(format(header));
console.log(widths.map((width) => "-".repeat(width)).join("  "));
for (const row of rows) console.log(format(row));

if (!coreOk || !reactOk || !combinedOk || !validatorImports) {
  console.error(
    "\ncheck:size failed. Production @skyloupe/core must be < 2048 gzip, core+react < 4096 gzip, and every entry must import in Node without touching document at load time.",
  );
  process.exit(1);
}
