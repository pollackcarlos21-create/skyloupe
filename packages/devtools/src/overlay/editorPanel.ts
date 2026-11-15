import { createPreviewManager, type AnnotationControlDefinition, type PreviewBinding } from "@skyloupe/core";
import type { AnnotationControlChangeDetail } from "@skyloupe/core";
import { recordControlChange, type ControlChangeRecord } from "../capture/bundleBuilder";
import type { AnnotationPick } from "../polyfill/picker";
import { registrationFor, type RegistrationEntry } from "../polyfill/registry";

type EditorControl = AnnotationControlDefinition;

let extraControls: AnnotationControlDefinition[] = [];

export async function ensureExtraControls(): Promise<void> {
  if (extraControls.length > 0) return;
  const mod = await import("./extraControls");
  extraControls = mod.builtIns();
}

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
  const liveValue = (control: EditorControl): string | number | boolean | undefined => {
    const input = panel.querySelector(`[data-callback="${control.callback}"]`);
    if (input instanceof HTMLInputElement && input.type === "checkbox") return input.checked;
    if (input instanceof HTMLInputElement && input.type === "range") return Number(input.value);
    if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) return input.value;
    return control.currentValue;
  };
  const dispatchCanvas = (action: "preview" | "preview-original" | "reset") => {
    if (pick.kind !== "canvas-object" || !target) return false;
    for (const control of controls) {
      const stored = "defaultValue" in control ? control.defaultValue : undefined;
      const value = action === "preview" ? liveValue(control) : (stored ?? liveValue(control));
      if (value === undefined) continue;
      const detail = { ...detailFor(pick, control.callback, value), action };
      target.dispatchEvent(new CustomEvent("oaiannotationcontrolchange", { detail, bubbles: true }));
    }
    return true;
  };
  const release = () => {
    if (dispatchCanvas("preview")) return;
    if (!last || !target) return;
    preview.apply({ ...last.detail, action: "preview" }, target, last.binding);
  };
  compare.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (dispatchCanvas("preview-original")) return;
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
    if (!dispatchCanvas("reset")) {
      if (last && target) preview.apply({ ...last.detail, action: "reset" }, target, last.binding);
      if (target && last) {
        target.dispatchEvent(new CustomEvent("oaiannotationcontrolchange", {
          detail: { ...last.detail, action: "reset" },
          bubbles: true,
        }));
      }
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
  control: EditorControl,
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

function controlsFor(entry: RegistrationEntry | undefined): EditorControl[] {
  if (!entry || entry.mode() === "extend") return [...(entry?.controls() ?? []), ...extraControls];
  return [...entry.controls()];
}

function bindingFor(control: EditorControl): PreviewBinding {
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
