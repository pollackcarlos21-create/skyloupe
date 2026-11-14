import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  return { raw: raw.length, gzip: gzipSync(raw).length, source: raw.toString("utf8") };
}

function hasDomSideEffect(source) {
  const stripped = source
    .replace(/`(?:\\.|[^`\\])*`/g, "''")
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/\btypeof\s+window\b/g, "")
    .replace(/\btypeof\s+document\b/g, "");
  return /\b(?:window|document)\b/.test(stripped);
}

const core = measure("packages/core/dist/index.js");
const react = measure("packages/react/dist/index.js");
const combined = core.gzip + react.gzip;
const coreDom = hasDomSideEffect(core.source);
const reactDom = hasDomSideEffect(react.source);
const coreOk = core.gzip < CORE_LIMIT && !coreDom;
const combinedOk = combined < COMBINED_LIMIT;
const reactOk = !reactDom;

const rows = [
  ["@skyloupe/core", core.raw, core.gzip, `<${CORE_LIMIT}`, coreOk ? "ok" : "FAIL"],
  ["@skyloupe/react", react.raw, react.gzip, "included in sum", reactOk ? "ok" : "FAIL"],
  ["core+react", "-", combined, `<${COMBINED_LIMIT}`, combinedOk ? "ok" : "FAIL"],
];
const header = ["package", "raw", "gzip", "limit", "status"];
const widths = header.map((label, index) =>
  Math.max(label.length, ...rows.map((row) => String(row[index]).length)),
);
const format = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join("  ");
console.log(format(header));
console.log(widths.map((width) => "-".repeat(width)).join("  "));
for (const row of rows) console.log(format(row));

if (!coreOk || !reactOk || !combinedOk) {
  console.error(
    "\ncheck:size failed. core gzip must be < 2048, core+react gzip sum must be < 4096, and neither bundle may touch window/document except via typeof.",
  );
  process.exit(1);
}
