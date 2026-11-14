import { createPreviewManager, type AnnotationControlDefinition, type PreviewBinding } from "@skyloupe/core";
import type { AnnotationControlChangeDetail } from "@skyloupe/core";
import { recordControlChange, type ControlChangeRecord } from "../capture/bundleBuilder";
import type { AnnotationPick } from "../polyfill/picker";
import { registrationFor, type RegistrationEntry } from "../polyfill/registry";

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

export interface EditorSession {
  pick?: AnnotationPick;
  changes: ControlChangeRecord[];
  comment: string;
  connected?: boolean;
  resetPreview?: () => void;
}

export function renderEditor(panel: HTMLElement, session: EditorSession, onChange: () => void): void {
  panel.replaceChildren();
  const pick = session.pick;
  if (!pick) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const target = elementOf(pick);
  const entry = target ? registrationFor(target) : undefined;
  const heading = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = titleFor(pick, entry);
  heading.append(title);
  const source = sourceFor(pick);
  if (source) {
    const place = document.createElement("p");
    place.className = "source";
    place.textContent = source;
    heading.append(place);
  }
  panel.append(heading);

  const preview = createPreviewManager();
  let last: { detail: AnnotationControlChangeDetail; binding: PreviewBinding } | undefined;
  session.resetPreview = () => {
    if (!last || !target) return;
    const detail = { ...last.detail, action: "reset" as const };
    preview.apply(detail, target, last.binding);
    target.dispatchEvent(new CustomEvent("oaiannotationcontrolchange", { detail, bubbles: true }));
  };
  const controls = controlsFor(entry);
  for (const control of controls) {
    panel.append(field(control, target, (value) => {
      if (!target) return;
      const detail = detailFor(pick, control.callback, value);
      const binding = bindingFor(control);
      last = { detail, binding };
      target.dispatchEvent(new CustomEvent("oaiannotationcontrolchange", { detail, bubbles: true }));
      if (binding.cssVar) preview.apply(detail, target, binding);
      const record = "options" in control
        ? recordControlChange(control, value)
        : {
            label: control.label,
            controlType: control.type,
            callback: control.callback,
            reference: "reference" in control ? control.reference : undefined,
            previousValue: session.changes.find((row) => row.callback === control.callback)?.previousValue ?? ("currentValue" in control ? control.currentValue : undefined),
            requestedValue: value,
          };
      const index = session.changes.findIndex((row) => row.callback === control.callback);
      if (index >= 0) {
        const prior = session.changes[index];
        if (prior) session.changes[index] = { ...prior, requestedValue: record.requestedValue };
      } else session.changes.push(record);
    }));
  }

  const compare = document.createElement("button");
  compare.type = "button";
  compare.dataset.skyloupeRole = "compare";
  compare.textContent = "Hold to compare";
  const release = () => {
    if (!last || !target) return;
    preview.apply({ ...last.detail, action: "preview" }, target, last.binding);
  };
  compare.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!last || !target) return;
    preview.apply({ ...last.detail, action: "preview-original" }, target, last.binding);
  });
  compare.addEventListener("pointerup", release);
  compare.addEventListener("pointerleave", release);
  panel.append(compare);

  const comment = document.createElement("label");
  comment.textContent = "Comment";
  const box = document.createElement("textarea");
  box.value = session.comment;
  box.addEventListener("input", () => {
    session.comment = box.value;
  });
  comment.append(box);
  panel.append(comment);

  const row = document.createElement("div");
  row.className = "row";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.dataset.skyloupeRole = "copy";
  copy.textContent = "Copy prompt";
  if (session.connected) {
    const send = document.createElement("button");
    send.type = "button";
    send.dataset.skyloupeRole = "send";
    send.textContent = "Send to Codex";
    row.append(send);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.dataset.skyloupeRole = "close";
  close.textContent = "Close";
  close.addEventListener("click", () => {
    if (last && target) preview.apply({ ...last.detail, action: "reset" }, target, last.binding);
    if (target && last) {
      target.dispatchEvent(new CustomEvent("oaiannotationcontrolchange", {
        detail: { ...last.detail, action: "reset" },
        bubbles: true,
      }));
    }
    session.pick = undefined;
    session.changes = [];
    onChange();
  });
  row.append(copy, close);
  panel.append(row);
  panel.dataset.entry = entry ? "registered" : "builtin";
}

function field(
  control: AnnotationControlDefinition | BuiltIn,
  target: Element | undefined,
  apply: (value: string | number | boolean) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.textContent = control.label;
  let input: HTMLElement;
  if (control.type === "range") {
    const range = document.createElement("input");
    range.type = "range";
    range.min = String(control.min);
    range.max = String(control.max);
    range.step = String(control.step);
    range.value = String(control.currentValue ?? control.min);
    range.dataset.callback = control.callback;
    range.addEventListener("input", () => apply(Number(range.value)));
    input = range;
  } else if (control.type === "color") {
    const color = document.createElement("input");
    color.type = "color";
    color.value = String(control.currentValue ?? "#ffffff");
    color.dataset.callback = control.callback;
    color.addEventListener("input", () => apply(color.value));
    input = color;
  } else if (control.type === "select") {
    const select = document.createElement("select");
    select.dataset.callback = control.callback;
    for (const option of control.options) {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.append(item);
    }
    select.value = String(control.currentValue ?? control.options[0]?.value ?? "");
    select.addEventListener("input", () => apply(select.value));
    input = select;
  } else {
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = control.currentValue === true;
    toggle.dataset.callback = control.callback;
    toggle.addEventListener("change", () => apply(toggle.checked));
    input = toggle;
  }
  if (!target) input.setAttribute("disabled", "");
  label.append(input);
  return label;
}

function controlsFor(entry: RegistrationEntry | undefined): Array<AnnotationControlDefinition | BuiltIn> {
  if (!entry || entry.mode() === "extend") {
    return [...(entry?.controls() ?? []), ...builtIns()];
  }
  return [...entry.controls()];
}

function builtIns(): AnnotationControlDefinition[] {
  return BUILT_INS.map((control) => {
    if (control.type === "color") {
      return { type: "color", label: control.label, callback: control.callback, reference: control.cssVar, currentValue: String(control.currentValue) };
    }
    return {
      type: "range",
      label: control.label,
      callback: control.callback,
      reference: control.cssVar,
      min: control.min ?? 0,
      max: control.max ?? 1,
      step: control.step ?? 1,
      currentValue: Number(control.currentValue),
    };
  });
}

function bindingFor(control: AnnotationControlDefinition | BuiltIn): PreviewBinding {
  const reference = "reference" in control ? control.reference : undefined;
  const cssVar = reference?.startsWith("--") || reference === "font-size" || reference === "color" || reference === "background-color" || reference === "padding"
    ? reference
    : undefined;
  const unit = control.type === "range" && cssVar ? "px" : "";
  return { callback: control.callback, cssVar, unit };
}

function detailFor(pick: AnnotationPick, callback: string, value: string | number | boolean): AnnotationControlChangeDetail {
  return {
    callback,
    value,
    action: "preview",
    virtualTarget: pick.kind === "canvas-object" ? { surfaceId: pick.element.id || "surface", targetId: pick.objectId } : undefined,
  };
}

function elementOf(pick: AnnotationPick): Element | undefined {
  return pick.kind === "text-range" ? undefined : pick.element;
}

function titleFor(pick: AnnotationPick, entry: RegistrationEntry | undefined): string {
  if (pick.kind === "canvas-object") return pick.objectName ?? pick.objectId;
  if (pick.kind === "text-range") return "Text selection";
  if (entry?.heading()) return entry.heading() ?? "Selection";
  return pick.name ?? pick.element.tagName.toLowerCase();
}

function sourceFor(pick: AnnotationPick): string | undefined {
  if (pick.kind === "text-range") return pick.containerSourceLocation;
  return pick.sourceLocation;
}
