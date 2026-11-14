import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const budgets = JSON.parse(readFileSync(join(root, "scripts/size-budget.json"), "utf8"));

let failed = false;
const rows = [];

for (const [name, budget] of Object.entries(budgets)) {
  const file = join(root, "packages", name, "dist", "index.js");
  if (!existsSync(file)) {
    failed = true;
    rows.push({ packageName: `@skyloupe/${name}`, raw: "-", gzip: "-", budget, status: "MISSING" });
    continue;
  }
  const rawBytes = readFileSync(file);
  const gzip = gzipSync(rawBytes).length;
  const status = gzip <= budget ? "ok" : "FAIL";
  if (status !== "ok") failed = true;
  rows.push({
    packageName: `@skyloupe/${name}`,
    raw: rawBytes.length,
    gzip,
    budget,
    status,
  });
}

const header = ["package", "raw", "gzip", "budget", "status"];
const cellsOf = (row) => [row.packageName, row.raw, row.gzip, row.budget, row.status];
const widths = header.map((label, index) =>
  Math.max(label.length, ...rows.map((row) => String(cellsOf(row)[index]).length)),
);
const format = (cells) => cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join("  ");

console.log(format(header));
console.log(widths.map((width) => "-".repeat(width)).join("  "));
for (const row of rows) console.log(format(cellsOf(row)));

if (failed) {
  console.error("\ncheck:size failed. Budgets are gzip bytes of packages/<name>/dist/index.js.");
  process.exit(1);
}
