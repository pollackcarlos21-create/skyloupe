import type { AnnotationControlAction, AnnotationControlChangeDetail } from "./types";

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

function styled(element: Element): CSSStyleDeclaration {
  return (element as HTMLElement).style;
}

function restoreStyle(element: Element, baseline: string | null): void {
  if (baseline === null) element.removeAttribute("style");
  else element.setAttribute("style", baseline);
}

export function createPreviewManager(): PreviewManager {
  const baselines = new WeakMap<Element, string | null>();

  const remember = (element: Element) => {
    if (!baselines.has(element)) baselines.set(element, element.getAttribute("style"));
  };

  const restore = (element: Element, forget: boolean) => {
    if (!baselines.has(element)) return;
    restoreStyle(element, baselines.get(element) ?? null);
    if (forget) baselines.delete(element);
  };

  const write = (detail: AnnotationControlChangeDetail, element: Element, binding: PreviewBinding) => {
    if (binding.callback !== detail.callback) return;
    remember(element);
    if (binding.cssVar) {
      const unit = binding.unit ?? "";
      styled(element).setProperty(binding.cssVar, `${detail.value}${unit}`);
    }
    binding.onApply?.(detail.value, element);
  };

  return {
    apply(detail, element, binding) {
      const action: AnnotationControlAction = detail.action;
      if (action === "reset") {
        restore(element, true);
        return;
      }
      if (action === "preview-original") {
        restore(element, false);
        return;
      }
      write(detail, element, binding);
    },
    dispose(element) {
      restore(element, true);
    },
  };
}
