import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { diagnoseAnnotatable, REFERENCE_NAME, validateMetadata } from "@skyloupe/core/validators";

export interface DoctorFinding {
  file: string;
  line: number;
  code: string;
  severity: "error" | "warning";
  message: string;
}

const SOURCE = /\.(tsx|jsx|ts|js)$/;
const SKIP = new Set(["node_modules", "dist", ".git", "coverage"]);

export function scanProject(root: string): { files: number; findings: DoctorFinding[] } {
  const stat = statSync(root);
  const files = stat.isDirectory() ? listFiles(root) : [root];
  const findings: DoctorFinding[] = [];
  for (const file of files) findings.push(...scanFile(file, stat.isDirectory() ? relative(root, file) : file));
  return { files: files.length, findings };
}

export function scanSource(file: string, code: string): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  const metadata = /oai-annotation-metadata\s*=\s*(["'])([\s\S]*?)\1/g;
  for (const match of code.matchAll(metadata)) {
    const raw = match[2] ?? "";
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
    for (const diagnostic of validateMetadata(parsed).diagnostics) {
      findings.push({
        file,
        line: lineOf(code, match.index ?? 0),
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message === "ignored" ? "`oai-annotation-metadata` is invalid and OpenAI ignores it." : diagnostic.message,
      });
    }
  }
  const references = /reference\s*[:=]\s*(["'])([^"']+)\1/g;
  for (const match of code.matchAll(references)) {
    const value = match[2] ?? "";
    if (REFERENCE_NAME.test(value)) continue;
    findings.push({
      file,
      line: lineOf(code, match.index ?? 0),
      code: "OAI-CTRL-004",
      severity: "error",
      message: `Control reference \`${value}\` contains characters outside A-Za-z0-9_./:@$#-.`,
    });
  }
  findings.push(...isolatedAnnotatables(file, code));
  return findings;
}

function scanFile(path: string, display: string): DoctorFinding[] {
  return scanSource(display, readFileSync(path, "utf8"));
}

function listFiles(root: string): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      else if (SOURCE.test(entry)) found.push(path);
    }
  };
  visit(root);
  return found;
}

function isolatedAnnotatables(file: string, code: string): DoctorFinding[] {
  const findings: DoctorFinding[] = [];
  const tags = /<\/?([A-Za-z][\w.-]*)\b([^>]*)>/g;
  const stack: Array<{ container: boolean }> = [];
  for (const match of code.matchAll(tags)) {
    const attrs = match[2] ?? "";
    const closing = match[0].startsWith("</");
    const selfClosing = match[0].endsWith("/>");
    if (closing) {
      stack.pop();
      continue;
    }
    const ancestor = stack.some((frame) => frame.container);
    const selfContainer = /oai-annotation-container(?:-text)?\b/.test(attrs);
    if (/\boai-annotatable\b/.test(attrs)) {
      for (const diagnostic of diagnoseAnnotatable(annotatableElement(attrs, ancestor))) {
        findings.push({
          file,
          line: lineOf(code, match.index ?? 0),
          code: diagnostic.code,
          severity: diagnostic.severity,
          message: "`oai-annotatable` used without an ancestor `oai-annotation-container` (will have no effect).",
        });
      }
    }
    if (!selfClosing) stack.push({ container: ancestor || selfContainer });
  }
  return findings;
}

function annotatableElement(attrs: string, ancestorContainer: boolean): Element {
  const names = new Set<string>();
  if (/\boai-annotatable\b/.test(attrs)) names.add("oai-annotatable");
  if (/oai-annotation-container(?:-text)?\b/.test(attrs)) names.add("oai-annotation-container");
  const parent = ancestorContainer
    ? ({
        hasAttribute: (name: string) => name === "oai-annotation-container" || name === "oai-annotation-container-text",
        parentElement: null,
      } as unknown as Element)
    : null;
  return {
    hasAttribute: (name: string) => names.has(name),
    parentElement: parent,
  } as unknown as Element;
}

function lineOf(code: string, index: number): number {
  return code.slice(0, index).split("\n").length;
}

export function formatDoctorReport(files: number, findings: readonly DoctorFinding[], elapsedMs: number): string {
  const lines = [`✔ Scanned ${files} files in ${elapsedMs}ms`];
  for (const finding of findings) {
    const mark = finding.severity === "warning" ? "⚠" : "✖";
    lines.push(`${mark} ${finding.file}:${finding.line}  [${finding.code}]  ${finding.message}`);
  }
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.length - errors;
  const touched = new Set(findings.map((finding) => finding.file)).size;
  lines.push(`Summary: ${errors} errors, ${warnings} warnings across ${touched} files.`);
  return lines.join("\n");
}
