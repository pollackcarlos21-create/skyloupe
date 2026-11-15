import { beforeEach, expect, test } from "vitest";
import type { AnnotationControlChangeDetail } from "@skyloupe/core";
import { installPolyfill, resetDevtools } from "../src/polyfill/installPolyfill";
import { elementFrame, placeHighlight } from "../src/overlay/highlightLayer";
import { renderEditor } from "../src/overlay/editorPanel";
import type { CanvasPick } from "../src/polyfill/picker";

beforeEach(() => {
  resetDevtools();
  document.body.replaceChildren();
});

test("the selection frame follows padding and per-corner radius", () => {
  const card = document.createElement("article");
  card.style.width = "200px";
  card.style.padding = "16px";
  card.style.borderRadius = "8px";
  document.body.append(card);
  const box = (width: number, height: number) => {
    card.getBoundingClientRect = () =>
      ({
        x: 10,
        y: 20,
        left: 10,
        top: 20,
        right: 10 + width,
        bottom: 20 + height,
        width,
        height,
        toJSON() {
          return {};
        },
      }) as DOMRect;
  };
  box(200, 80);
  const before = elementFrame(card);
  expect(before.rect).toEqual({ x: 10, y: 20, width: 200, height: 80 });
  expect(before.radius === "8px" || before.radius === "8px 8px 8px 8px").toBe(true);

  card.style.padding = "40px";
  card.style.borderTopLeftRadius = "28px";
  card.style.borderTopRightRadius = "28px";
  card.style.borderBottomRightRadius = "4px";
  card.style.borderBottomLeftRadius = "4px";
  box(248, 140);
  const after = elementFrame(card);
  expect(after.rect).toEqual({ x: 10, y: 20, width: 248, height: 140 });
  expect(after.radius).toBe("28px 28px 4px 4px");

  const highlight = document.createElement("div");
  placeHighlight(highlight, after);
  expect(highlight.hidden).toBe(false);
  expect(highlight.style.width).toBe("248px");
  expect(highlight.style.height).toBe("140px");
  expect(highlight.style.borderRadius).toBe("28px 28px 4px 4px");
});

test("switching canvas targets shows that target's values and compare uses its originals", () => {
  installPolyfill();
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const controlsFor = (color: string, radius: number, originalRadius: number) => [
    { type: "color" as const, label: "Bar color", callback: "setBarColor", currentValue: color, defaultValue: color },
    {
      type: "range" as const,
      label: "Bar radius",
      callback: "setBarRadius",
      min: 0,
      max: 16,
      step: 1,
      currentValue: radius,
      defaultValue: originalRadius,
    },
  ];
  const handle = document.oai?.annotation?.registerControls({
    targets: [canvas],
    controlsHeading: "Quarter bar",
    controls: controlsFor("#0f766e", 12, 6),
  });
  const panel = document.createElement("section");
  document.body.append(panel);
  const pick = (id: string): CanvasPick => ({ kind: "canvas-object", element: canvas, objectId: id, objectName: id.toUpperCase() });

  renderEditor(panel, { pick: pick("q3"), changes: [], comment: "" }, () => undefined);
  expect(value(panel, "setBarColor")).toBe("#0f766e");
  expect(value(panel, "setBarRadius")).toBe("12");

  handle?.update({ controls: controlsFor("#c2410c", 6, 6) });
  renderEditor(panel, { pick: pick("q1"), changes: [], comment: "" }, () => undefined);
  expect(value(panel, "setBarColor")).toBe("#c2410c");
  expect(value(panel, "setBarRadius")).toBe("6");

  const events: AnnotationControlChangeDetail[] = [];
  canvas.addEventListener("oaiannotationcontrolchange", (event) => {
    events.push((event as CustomEvent<AnnotationControlChangeDetail>).detail);
  });
  panel.querySelector<HTMLButtonElement>("[data-skyloupe-role=compare]")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  expect(events.map((event) => event.action)).toEqual(["preview-original", "preview-original"]);
  expect(events.map((event) => event.value)).toEqual(["#c2410c", 6]);
  expect(events.every((event) => event.virtualTarget?.targetId === "q1")).toBe(true);
});

function value(panel: ParentNode, callback: string): string {
  const input = panel.querySelector(`[data-callback="${callback}"]`);
  if (!(input instanceof HTMLInputElement)) throw new Error(`missing ${callback}`);
  return input.value;
}
