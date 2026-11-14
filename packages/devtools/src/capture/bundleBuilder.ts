import type { AnnotationControlDefinition, AnnotationMetadata, SurfaceRect } from "@skyloupe/core";
import type { AnnotationPick } from "../polyfill/picker";
import type { RegistrationEntry } from "../polyfill/registry";
import { captureTarget, maskedExcerpt } from "./screenshot";

export interface ControlChangeRecord {
  label: string;
  controlType: "color" | "range" | "select" | "toggle";
  callback: string;
  reference?: string;
  previousValue?: string | number | boolean;
  requestedValue: string | number | boolean;
  unchangedExplicitChoice?: boolean;
}

export interface AnnotationBundle {
  id: string;
  createdAt: string;
  pageUrl: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  target:
    | {
        kind: "element";
        annotatableName?: string;
        tagName: string;
        selector: string;
        sourceLocation?: string;
        boundingBox: SurfaceRect;
        textExcerpt?: string;
      }
    | {
        kind: "text-range";
        selectedText: string;
        surroundingContext: string;
        containerSourceLocation?: string;
      }
    | {
        kind: "canvas-object";
        canvasSelector: string;
        canvasSourceLocation?: string;
        objectId: string;
        objectName?: string;
        objectRole?: string;
        boundingBox?: SurfaceRect;
      };
  metadata?: AnnotationMetadata;
  controlChanges: ControlChangeRecord[];
  comment?: string;
  screenshotPath?: string;
}

export function recordControlChange(
  control: AnnotationControlDefinition,
  requested: string | number | boolean,
): ControlChangeRecord {
  if (control.type === "select") {
    const previous = control.options.find((option) => option.value === (control.currentValue ?? control.options[0]?.value));
    const next = control.options.find((option) => option.value === requested);
    return {
      label: control.label,
      controlType: "select",
      callback: control.callback,
      reference: control.reference,
      previousValue: previous?.label,
      requestedValue: next?.label ?? String(requested),
    };
  }
  return {
    label: control.label,
    controlType: control.type,
    callback: control.callback,
    reference: control.reference,
    previousValue: control.currentValue,
    requestedValue: requested,
  };
}

export function withUnchangedChoices(
  changes: readonly ControlChangeRecord[],
  entry: RegistrationEntry | undefined,
): ControlChangeRecord[] {
  const next = [...changes];
  if (!entry) return next;
  for (const control of entry.controls()) {
    if (control.type !== "select" || !entry.omitted.has(control.callback) || next.some((row) => row.callback === control.callback)) {
      continue;
    }
    const label = control.options.find((option) => option.value === control.currentValue)?.label;
    next.push({
      label: control.label,
      controlType: "select",
      callback: control.callback,
      reference: control.reference,
      previousValue: label,
      requestedValue: label ?? "",
      unchangedExplicitChoice: true,
    });
  }
  return next;
}

export async function buildAnnotationBundle(input: {
  pick: AnnotationPick;
  changes: readonly ControlChangeRecord[];
  comment?: string;
  omitScreenshot?: boolean;
}): Promise<AnnotationBundle> {
  const screenshotPath = await captureTarget(input.pick, input.omitScreenshot);
  const bundle: AnnotationBundle = {
    id: `ann_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    pageUrl: location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    target: targetOf(input.pick),
    controlChanges: [...input.changes],
    comment: input.comment,
    screenshotPath,
  };
  if (input.pick.kind === "element") bundle.metadata = input.pick.metadata;
  if (input.pick.kind === "canvas-object") bundle.metadata = input.pick.metadata;
  return bundle;
}

function targetOf(pick: AnnotationPick): AnnotationBundle["target"] {
  if (pick.kind === "text-range") {
    return {
      kind: "text-range",
      selectedText: pick.selectedText,
      surroundingContext: pick.surroundingContext,
      containerSourceLocation: pick.containerSourceLocation,
    };
  }
  if (pick.kind === "canvas-object") {
    return {
      kind: "canvas-object",
      canvasSelector: selectorFor(pick.element),
      canvasSourceLocation: pick.sourceLocation,
      objectId: pick.objectId,
      objectName: pick.objectName,
      objectRole: pick.objectRole,
      boundingBox: pick.box,
    };
  }
  return {
    kind: "element",
    annotatableName: pick.name,
    tagName: pick.element.tagName.toLowerCase(),
    selector: selectorFor(pick.element),
    sourceLocation: pick.sourceLocation,
    boundingBox: pick.box,
    textExcerpt: maskedExcerpt(pick.element),
  };
}

function selectorFor(element: Element): string {
  if (element.id) return `#${cssEscape(element.id)}`;
  const name = element.getAttribute("oai-annotatable");
  if (name) return `[oai-annotatable="${cssEscape(name)}"]`;
  return element.tagName.toLowerCase();
}

function cssEscape(value: string): string {
  const escape = globalThis.CSS?.escape;
  if (escape) return escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

export function formatAnnotationMarkdown(bundle: AnnotationBundle): string {
  const target = bundle.target;
  const lines = [
    `Apply the following UI annotation captured from the live page (\`${bundle.pageUrl}\`, viewport ${bundle.viewport.width}×${bundle.viewport.height}):`,
    "",
    "### Target",
  ];
  if (target.kind === "element") {
    const name = target.annotatableName ?? target.tagName;
    lines.push(`- **Object**: \`${name}\` (\`<${target.tagName}${target.selector}>\`)`);
    if (target.sourceLocation) lines.push(`- **Source location**: \`${target.sourceLocation}\``);
    if (bundle.metadata) lines.push(`- **Metadata**: \`${JSON.stringify(bundle.metadata)}\``);
  } else if (target.kind === "canvas-object") {
    lines.push(`- **Object**: \`${target.objectName ?? target.objectId}\` (\`${target.canvasSelector}\`)`);
    if (target.canvasSourceLocation) lines.push(`- **Source location**: \`${target.canvasSourceLocation}\``);
    if (bundle.metadata) lines.push(`- **Metadata**: \`${JSON.stringify(bundle.metadata)}\``);
  } else {
    lines.push(`- **Object**: text \`${target.selectedText}\``);
    if (target.containerSourceLocation) lines.push(`- **Source location**: \`${target.containerSourceLocation}\``);
  }
  lines.push("", "### Requested Control & Token Changes", "| Control | Token / Reference | Previous | Requested |", "|---|---|---|---|");
  for (const change of bundle.controlChanges) {
    lines.push(`| ${change.label} | \`${change.reference ?? ""}\` | \`${String(change.previousValue ?? "")}\` | \`${String(change.requestedValue)}\` |`);
  }
  lines.push(
    "",
    "### User Comment",
    bundle.comment ? `> ${bundle.comment}` : ">",
    "",
    "### Instructions",
    "1. Update the underlying source code / CSS tokens referenced above so the rendered UI matches the requested values permanently (do not leave temporary inline debug styles).",
    "2. Keep the change scoped to the annotated component or design token.",
    "3. Verify that TypeScript compiles cleanly.",
    "",
  );
  return lines.join("\n");
}
