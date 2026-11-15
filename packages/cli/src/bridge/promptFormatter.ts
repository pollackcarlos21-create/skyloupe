export interface ControlChangeRecord {
  label: string;
  controlType?: "color" | "range" | "select" | "toggle";
  callback?: string;
  reference?: string;
  previousValue?: string | number | boolean;
  requestedValue: string | number | boolean;
}

export interface AnnotationBundle {
  id?: string;
  pageUrl?: string;
  viewport?: { width: number; height: number };
  target?:
    | {
        kind: "element";
        annotatableName?: string;
        tagName: string;
        selector: string;
        sourceLocation?: string;
      }
    | {
        kind: "text-range";
        selectedText: string;
        surroundingContext?: string;
        containerSourceLocation?: string;
      }
    | {
        kind: "canvas-object";
        canvasSelector: string;
        canvasSourceLocation?: string;
        objectId: string;
        objectName?: string;
      };
  metadata?: Record<string, string | number | boolean | null>;
  controlChanges?: ControlChangeRecord[];
  comment?: string;
  screenshotPath?: string;
}

export function formatAnnotationPrompt(bundle: AnnotationBundle): string {
  const page = bundle.pageUrl ?? "the live page";
  const viewport = bundle.viewport ? `${bundle.viewport.width}×${bundle.viewport.height}` : "unknown";
  const lines = [
    `Apply the following UI annotation captured from the live page (\`${page}\`, viewport ${viewport}):`,
    "",
    "### Target",
    ...targetLines(bundle),
    "",
    "### Requested Control & Token Changes",
    "| Control | Token / Reference | Previous | Requested |",
    "|---|---|---|---|",
  ];
  for (const change of bundle.controlChanges ?? []) {
    lines.push(
      `| ${change.label} | \`${change.reference ?? ""}\` | \`${String(change.previousValue ?? "")}\` | \`${String(change.requestedValue)}\` |`,
    );
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

function targetLines(bundle: AnnotationBundle): string[] {
  const target = bundle.target;
  if (!target) return ["- **Object**: unknown"];
  if (target.kind === "element") {
    const name = target.annotatableName ?? target.tagName;
    const lines = [`- **Object**: \`${name}\` (\`<${target.tagName}${target.selector}>\`)`];
    if (target.sourceLocation) lines.push(`- **Source location**: \`${target.sourceLocation}\``);
    if (bundle.metadata) lines.push(`- **Metadata**: \`${JSON.stringify(bundle.metadata)}\``);
    return lines;
  }
  if (target.kind === "canvas-object") {
    const lines = [`- **Object**: \`${target.objectName ?? target.objectId}\` (\`${target.canvasSelector}\`)`];
    if (target.canvasSourceLocation) lines.push(`- **Source location**: \`${target.canvasSourceLocation}\``);
    if (bundle.metadata) lines.push(`- **Metadata**: \`${JSON.stringify(bundle.metadata)}\``);
    return lines;
  }
  const lines = [`- **Object**: text \`${target.selectedText}\``];
  if (target.containerSourceLocation) lines.push(`- **Source location**: \`${target.containerSourceLocation}\``);
  return lines;
}
