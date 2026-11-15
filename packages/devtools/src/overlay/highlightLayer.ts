import type { SurfaceRect } from "@skyloupe/core";
import type { AnnotationPick } from "../polyfill/picker";

const CANVAS_LOCATE = Symbol.for("skyloupe.locateCanvasTarget");

export interface HighlightFrame {
  rect: SurfaceRect;
  radius: string;
}

interface CanvasTargetGeometry {
  rect: SurfaceRect;
  radius: number;
}

export function placeHighlight(box: HTMLElement, frame: HighlightFrame | undefined): void {
  const rect = frame?.rect;
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.style.left = `${rect.x}px`;
  box.style.top = `${rect.y}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
  box.style.borderRadius = frame.radius;
}

export function elementFrame(element: Element): HighlightFrame {
  const box = element.getBoundingClientRect();
  return {
    rect: { x: box.x, y: box.y, width: box.width, height: box.height },
    radius: cornerRadius(getComputedStyle(element)),
  };
}

function cornerRadius(style: CSSStyleDeclaration): string {
  const corners = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ];
  if (corners.every((corner) => corner)) return corners.join(" ");
  return style.borderRadius || "0px";
}

export function frameForPick(pick: AnnotationPick): HighlightFrame | undefined {
  if (pick.kind === "text-range") return { rect: pick.box, radius: "0px" };
  if (pick.kind === "element") return elementFrame(pick.element);
  const locate = (pick.element as HTMLCanvasElement & { [CANVAS_LOCATE]?: (id: string) => CanvasTargetGeometry | null })[CANVAS_LOCATE];
  const live = locate?.(pick.objectId);
  if (live) return { rect: live.rect, radius: `${live.radius}px` };
  if (pick.box) return { rect: pick.box, radius: `${pick.radius ?? 0}px` };
  return undefined;
}
