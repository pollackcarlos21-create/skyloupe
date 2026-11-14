import type { AnnotationControlChangeDetail } from "./types";

export interface PreviewBinding {
  callback: string;
  cssVar?: string;
  unit?: string;
  onApply?: (value: string | number | boolean, element: Element) => void;
}

export interface PreviewManager {
  apply(detail: AnnotationControlChangeDetail, element: Element, binding: PreviewBinding): void;
  dispose(element: Element): void;
}

export function createPreviewManager(): PreviewManager {
  const base = new WeakMap<Element, string | null>();
  const restore = (element: Element, forget: boolean) => {
    if (!base.has(element)) return;
    const value = base.get(element) ?? null;
    if (value === null) element.removeAttribute("style");
    else element.setAttribute("style", value);
    if (forget) base.delete(element);
  };
  return {
    apply(detail, element, binding) {
      if (binding.callback !== detail.callback) return;
      if (detail.action === "reset") return restore(element, true);
      if (detail.action === "preview-original") return restore(element, false);
      if (!base.has(element)) base.set(element, element.getAttribute("style"));
      if (binding.cssVar) {
        (element as HTMLElement).style.setProperty(binding.cssVar, `${detail.value}${binding.unit ?? ""}`);
      }
      binding.onApply?.(detail.value, element);
    },
    dispose: (element) => restore(element, true),
  };
}
