import { beforeEach, expect, test } from "vitest";
import { resetSurfaceState } from "../../core/src/surfaceGuard";
import { installPolyfill, resetDevtools } from "../src/polyfill/installPolyfill";
import { pickAt } from "../src/polyfill/picker";

beforeEach(() => {
  resetDevtools();
  resetSurfaceState();
  document.body.replaceChildren();
});

test("a canvas hit wins over the DOM element underneath", async () => {
  installPolyfill();
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const card = document.createElement("article");
  document.body.append(card);
  document.elementFromPoint = () => card;
  document.oai?.annotation?.registerSurface({
    element: canvas,
    hitTest: () => ({ id: "q3", name: "Q3", rect: { x: 1, y: 2, width: 3, height: 4 } }),
  });
  const pick = await pickAt(10, 10);
  expect(pick).toMatchObject({ kind: "canvas-object", objectId: "q3", objectName: "Q3" });
});

test("a surface miss falls through to the element under the pointer", async () => {
  installPolyfill();
  const canvas = document.createElement("canvas");
  const card = document.createElement("article");
  card.setAttribute("oai-annotatable", "Pricing Card (Pro)");
  document.body.append(canvas, card);
  document.elementFromPoint = () => card;
  document.oai?.annotation?.registerSurface({ element: canvas, hitTest: () => null });
  const pick = await pickAt(10, 10);
  expect(pick).toMatchObject({ kind: "element", element: card, name: "Pricing Card (Pro)" });
});
