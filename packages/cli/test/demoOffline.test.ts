import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { findRepoRoot } from "../src/commands/demo";
import { scanProject } from "../src/doctor/astScanner";
import { main } from "../src/cli";

test("skyloupe demo --offline completes the recorded edit and HMR replay", async () => {
  const root = findRepoRoot();
  const card = join(root, "demo/app/src/components/PricingCard.tsx");
  const before = readFileSync(card, "utf8");
  const lines: string[] = [];
  const code = await main(["demo", "--offline"], (text) => lines.push(text));
  const log = lines.join("");
  expect(code).toBe(0);
  expect(log).toContain("SkyLoupe demo (offline)");
  expect(log).toContain("Make Pro stand out");
  expect(log).toContain("Q3 Revenue highlight recorded");
  expect(log).toContain("Codex editing src/components/PricingCard.tsx... Done (5.2s)");
  expect(log).toContain("HMR served the updated accent #0f766e and radius 20px");
  expect(log).toContain("Replay complete. No Codex CLI and no network.");
  expect(readFileSync(card, "utf8")).toBe(before);
});

test("the demo source has exactly two planted spec violations", () => {
  const root = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const { findings } = scanProject(join(root, "demo/app/src"));
  expect(findings.map((finding) => finding.code).sort()).toEqual(["OAI-DOM-001", "OAI-META-001"]);
});
