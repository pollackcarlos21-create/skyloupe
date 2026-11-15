import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { formatDoctorReport, scanProject } from "../src/doctor/astScanner";
import { initProject } from "../src/commands/init";
import { enqueue, getAnnotation, listPending, resolveAnnotation } from "../src/bridge/store";
import { mcpToolNames } from "../src/mcp/server";

test("doctor reports metadata, isolated annotatables, and spaced references with validator codes", () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-doctor-"));
  writeFileSync(
    join(root, "UserRow.tsx"),
    [
      "export function UserRow() {",
      "  return (",
      "    <div>",
      "      <span oai-annotatable=\"User\" oai-annotation-metadata='{\"profile\":{\"name\":\"Ada\"}}' />",
      "    </div>",
      "  );",
      "}",
      "const control = { reference: \"card padding\" };",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(root, "Card.tsx"),
    "<div oai-annotation-container><article oai-annotatable=\"Card\" oai-annotation-metadata='{\"planId\":\"Pro\"}' /></div>\n",
    "utf8",
  );
  const { files, findings } = scanProject(root);
  expect(files).toBe(2);
  expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["OAI-META-001", "OAI-DOM-001", "OAI-CTRL-004"]));
  expect(findings.some((finding) => finding.file === "Card.tsx" && finding.code === "OAI-DOM-001")).toBe(false);
  const report = formatDoctorReport(files, findings, 4);
  expect(report).toContain("✔ Scanned 2 files");
  expect(report).toContain("[OAI-META-001]");
  expect(report).toContain("Summary:");
});

test("init adds .skyloupe to gitignore", () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-init-"));
  writeFileSync(join(root, ".gitignore"), "node_modules\n", "utf8");
  const text = initProject(root);
  expect(text).toContain(".skyloupe/");
  expect(initProject(root)).toContain(".skyloupe/");
});

test("mcp tools list, read, and resolve the annotation queue", () => {
  const root = mkdtempSync(join(tmpdir(), "skyloupe-mcp-"));
  expect(mcpToolNames).toEqual(["list_pending_annotations", "get_annotation", "resolve_annotation"]);
  enqueue(root, {
    id: "ann_1",
    status: "pending",
    imagePath: "/tmp/skyloupe/ann_1.png",
    bundle: { comment: "more room", target: { kind: "element", tagName: "article", selector: "#card" } },
  });
  expect(listPending(root).map((item) => item.id)).toEqual(["ann_1"]);
  expect(getAnnotation(root, "ann_1")?.imagePath).toBe("/tmp/skyloupe/ann_1.png");
  expect(resolveAnnotation(root, "ann_1", "updated the token")?.status).toBe("resolved");
  expect(listPending(root)).toEqual([]);
});
