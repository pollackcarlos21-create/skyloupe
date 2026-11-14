import { surfaceDiagnostics } from "@skyloupe/core";
import type { Diagnostic } from "@skyloupe/core/validators";
import { diagnoseAnnotatable, validateMetadata } from "@skyloupe/core/validators";

export interface VisibleDiagnostic extends Diagnostic {
  target?: string;
}

const HINTS: Record<string, string> = {
  "OAI-ENV-001": "Open the page as a secure top-level document, not inside a framed or insecure origin.",
  "OAI-DOM-001": "Place the annotatable inside an annotation container.",
  "OAI-DOM-002": "container-text wins when both container attributes sit on the same element.",
  "OAI-META-001": "Use a flat object of at most 6 string, finite number, boolean, or null fields.",
  "OAI-META-002": "Keys are short ASCII identifiers with single spaces, and the JSON payload stays under 2 KB.",
  "OAI-REQ-001": "Call toggle or request during a user gesture, with at most one open request.",
  "OAI-REQ-002": "The target must be visible, and a text range cannot use advanced mode.",
  "OAI-CTRL-001": "Stay within 64 registrations and 1024 target links.",
  "OAI-CTRL-002": "Use at most 12 controls, unique callbacks, and only the fields for that control type.",
  "OAI-CTRL-003": "Keep labels and headings to 1–80 characters without control or bidi characters.",
  "OAI-CTRL-004": "Callbacks are identifiers and references cannot contain spaces.",
  "OAI-CTRL-005": "Range min, max, step, and the start value must sit inside the official bounds.",
  "OAI-CTRL-006": "Colors are hex and toggles are booleans.",
  "OAI-CTRL-007": "Select options need unique values; the recorded annotation uses the visible label.",
  "OAI-CTRL-008": "Do not update a disposed registration; a failed update keeps the previous state.",
  "OAI-SURF-001": "Register the surface on a connected element in the top document, outside shadow DOM.",
  "OAI-SURF-002": "hitTest must settle. A hung call locks the single slot and picking falls back to the DOM.",
  "OAI-MODE-001": "Hold Space to let clicks reach the page. isActive updates before the mode event.",
};

export function scanDiagnostics(root: ParentNode = document): VisibleDiagnostic[] {
  const found: VisibleDiagnostic[] = [];
  const seen = new Set<string>();
  const add = (items: readonly Diagnostic[], target?: string) => {
    for (const item of items) {
      const key = `${item.code}:${item.field}:${target ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ ...item, target });
    }
  };
  if ("querySelectorAll" in root) {
    root.querySelectorAll("[oai-annotatable]").forEach((element) => {
      add(diagnoseAnnotatable(element), describe(element));
    });
    root.querySelectorAll("[oai-annotation-metadata]").forEach((element) => {
      const raw = element.getAttribute("oai-annotation-metadata") ?? "";
      let parsed: unknown = raw;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      add(validateMetadata(parsed).diagnostics, describe(element));
    });
  }
  add(surfaceDiagnostics(), "hitTest");
  return found;
}

export function hintFor(code: string): string {
  return HINTS[code] ?? "See the official annotation rule for this code.";
}

function describe(element: Element): string {
  const source = element.getAttribute("data-skyloupe-source");
  const name = element.getAttribute("oai-annotatable");
  const id = element.id ? `#${element.id}` : element.tagName.toLowerCase();
  return [name, id, source].filter(Boolean).join(" · ");
}

export function renderDrawer(host: HTMLElement, items: readonly VisibleDiagnostic[]): void {
  host.replaceChildren();
  if (items.length === 0) {
    host.append(note("No spec issues on this page."));
    return;
  }
  for (const item of items) {
    const row = document.createElement("article");
    row.className = item.code === "OAI-SURF-002" || item.severity === "warning" ? "issue warn" : "issue";
    const code = document.createElement("strong");
    code.textContent = item.code;
    const where = document.createElement("p");
    where.textContent = item.target ?? item.field;
    const hint = document.createElement("p");
    hint.textContent = hintFor(item.code);
    row.append(code, where, hint);
    host.append(row);
  }
}

function note(text: string): HTMLElement {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}
