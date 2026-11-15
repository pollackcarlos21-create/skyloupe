import type { AnnotationControlDefinition } from "@skyloupe/core";

interface BuiltIn {
  type: "color" | "range";
  label: string;
  callback: string;
  cssVar: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  currentValue: string | number;
}

const BUILT_INS: readonly BuiltIn[] = [
  { type: "range", label: "Font size", callback: "skyloupeFontSize", cssVar: "font-size", unit: "px", min: 12, max: 32, step: 1, currentValue: 16 },
  { type: "color", label: "Text color", callback: "skyloupeTextColor", cssVar: "color", currentValue: "#1c1917" },
  { type: "color", label: "Background", callback: "skyloupeBackground", cssVar: "background-color", currentValue: "#ffffff" },
  { type: "range", label: "Padding", callback: "skyloupePadding", cssVar: "padding", unit: "px", min: 0, max: 48, step: 1, currentValue: 0 },
];

export function builtIns(): AnnotationControlDefinition[] {
  return BUILT_INS.map((control) =>
    control.type === "color"
      ? { type: "color", label: control.label, callback: control.callback, reference: control.cssVar, currentValue: String(control.currentValue) }
      : {
          type: "range",
          label: control.label,
          callback: control.callback,
          reference: control.cssVar,
          min: control.min ?? 0,
          max: control.max ?? 1,
          step: control.step ?? 1,
          currentValue: Number(control.currentValue),
        },
  );
}
