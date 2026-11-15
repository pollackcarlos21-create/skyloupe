import type { AnnotationControlDefinition } from "@skyloupe/core";
import type { PreviewBinding } from "@skyloupe/core";

export type PreviewControl = AnnotationControlDefinition & {
  cssVar?: string;
  unit?: string;
  onApply?: PreviewBinding["onApply"];
};

const PREVIEW_FIELDS = new Set(["cssVar", "unit", "onApply"]);

export function toOfficialControl(control: PreviewControl): AnnotationControlDefinition {
  const official: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(control)) {
    if (!PREVIEW_FIELDS.has(key)) official[key] = value;
  }
  return official as unknown as AnnotationControlDefinition;
}

export function toPreviewBinding(control: PreviewControl): PreviewBinding {
  return {
    callback: control.callback,
    cssVar: control.cssVar,
    unit: control.unit,
    onApply: control.onApply,
  };
}
