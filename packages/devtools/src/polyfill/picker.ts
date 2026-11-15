import { runHitTest, surfaceDiagnostics } from "@skyloupe/core";
import { resolveAnnotationGesture, validateMetadata } from "@skyloupe/core/validators";
import type { AnnotationMetadata, SurfaceHitTestResult, SurfaceRect } from "@skyloupe/core";
import { activeSurfaces } from "./registry";

export interface ElementPick {
  kind: "element";
  element: Element;
  name?: string;
  sourceLocation?: string;
  metadata?: AnnotationMetadata;
  box: SurfaceRect;
}

export interface TextPick {
  kind: "text-range";
  selectedText: string;
  surroundingContext: string;
  containerSourceLocation?: string;
  box: SurfaceRect;
}

export interface CanvasPick {
  kind: "canvas-object";
  element: HTMLCanvasElement;
  objectId: string;
  objectName?: string;
  objectRole?: string;
  metadata?: AnnotationMetadata;
  sourceLocation?: string;
  box?: SurfaceRect;
}

export type AnnotationPick = ElementPick | TextPick | CanvasPick;

export async function pickAt(clientX: number, clientY: number): Promise<AnnotationPick | undefined> {
  const before = surfaceDiagnostics().length;
  for (const surface of activeSurfaces()) {
    const signal = new AbortController();
    const timer = setTimeout(() => signal.abort(), 250);
    const hit = await runHitTest(
      (args) => surface.hitTest(args),
      { clientX, clientY, signal: signal.signal },
    ).finally(() => clearTimeout(timer));
    if (surfaceDiagnostics().length > before) break;
    if (!hit) continue;
    surface.renderSelection?.({ hoveredId: hit.id, selectedId: hit.id });
    return canvasPick(surface.element, hit);
  }
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit || hit.localName === "skyloupe-devtools-host") return undefined;
  const element = hit.closest("[oai-annotatable]") ?? hit;
  const gesture = resolveAnnotationGesture(element);
  const selection = document.getSelection();
  if (gesture === "text" && selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (element.contains(range.commonAncestorContainer)) {
      const text = range.toString();
      const around = range.commonAncestorContainer.textContent ?? text;
      return {
        kind: "text-range",
        selectedText: text,
        surroundingContext: around.trim().slice(0, 240),
        containerSourceLocation: sourceOf(element),
        box: rectOf(typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 }),
      };
    }
  }
  return {
    kind: "element",
    element,
    name: element.getAttribute("oai-annotatable") ?? undefined,
    sourceLocation: sourceOf(element),
    metadata: metadataOf(element),
    box: rectOf(element.getBoundingClientRect()),
  };
}

function canvasPick(element: HTMLElement, hit: SurfaceHitTestResult): CanvasPick {
  return {
    kind: "canvas-object",
    element: element as HTMLCanvasElement,
    objectId: hit.id,
    objectName: hit.name,
    objectRole: hit.role,
    metadata: hit.metadata,
    sourceLocation: sourceOf(element),
    box: hit.rect,
  };
}

function sourceOf(element: Element): string | undefined {
  const own = element.getAttribute("data-skyloupe-source");
  if (own) return own;
  const host = element.closest("[data-skyloupe-source]");
  return host?.getAttribute("data-skyloupe-source") ?? undefined;
}

function metadataOf(element: Element): AnnotationMetadata | undefined {
  const raw = element.getAttribute("oai-annotation-metadata");
  if (!raw) return undefined;
  try {
    const result = validateMetadata(JSON.parse(raw));
    return result.diagnostics.length === 0 ? result.metadata : undefined;
  } catch {
    return undefined;
  }
}

function rectOf(rect: Pick<DOMRect, "x" | "y" | "width" | "height">): SurfaceRect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
