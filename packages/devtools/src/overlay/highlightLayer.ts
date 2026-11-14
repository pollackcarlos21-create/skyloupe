import type { SurfaceRect } from "@skyloupe/core";

export function placeHighlight(box: HTMLElement, rect: SurfaceRect | undefined): void {
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.style.left = `${rect.x}px`;
  box.style.top = `${rect.y}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}
