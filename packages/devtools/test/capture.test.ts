import { expect, test, vi } from "vitest";
import { buildAnnotationBundle, formatAnnotationMarkdown, recordControlChange } from "../src/capture/bundleBuilder";
import { maskTree, maskedExcerpt } from "../src/capture/screenshot";
import type { ElementPick } from "../src/polyfill/picker";

test("masks passwords, payment fields, and ignored subtrees", () => {
  const form = document.createElement("form");
  form.innerHTML = `Hello <span data-skyloupe-ignore>hunter2</span><input type="password" value="hunter2" /><input autocomplete="cc-number" value="4242" /><b data-1p-ignore>secret</b>`;
  const password = form.querySelector("input[type=password]") as HTMLInputElement;
  password.value = "hunter2";
  maskTree(form);
  expect(form.textContent).not.toContain("hunter2");
  expect(form.textContent).not.toContain("secret");
  expect(password.value).toBe("••••");
  expect(form.querySelector("[autocomplete='cc-number']")?.getAttribute("value")).toBe("••••");
  expect(maskedExcerpt(form)).toBe("Hello");
});

test("a capture failure still produces the markdown bundle", async () => {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
    throw new Error("tainted");
  });
  const canvas = document.createElement("canvas");
  canvas.id = "chart";
  const pick = {
    kind: "canvas-object",
    element: canvas,
    objectId: "q3",
    objectName: "Q3",
    box: { x: 0, y: 0, width: 20, height: 10 },
  } as const;
  const bundle = await buildAnnotationBundle({
    pick,
    changes: [recordControlChange(
      { type: "select", label: "Tone", callback: "setTone", options: [{ label: "Calm", value: "calm" }, { label: "Bold", value: "bold" }], currentValue: "calm" },
      "bold",
    )],
    comment: "Use the teal token.",
  });
  expect(bundle.screenshotPath).toBeUndefined();
  expect(bundle.controlChanges[0]).toMatchObject({ previousValue: "Calm", requestedValue: "Bold" });
  const markdown = formatAnnotationMarkdown(bundle);
  expect(markdown).toContain("### Target");
  expect(markdown).toContain("Q3");
  expect(markdown).toContain("### Requested Control & Token Changes");
  expect(markdown).toContain("Bold");
  expect(markdown).toContain("### User Comment");
  expect(markdown).toContain("Use the teal token.");
  expect(markdown).toContain("### Instructions");
  expect(markdown).toContain("TypeScript compiles");
  spy.mockRestore();
});

test("omitScreenshot skips capture for an element pick", async () => {
  const element = document.createElement("article");
  element.id = "card";
  element.textContent = "Pro";
  const pick: ElementPick = {
    kind: "element",
    element,
    name: "Pricing Card (Pro)",
    sourceLocation: "src/components/PricingCard.tsx:31:4",
    metadata: { planId: "Pro" },
    box: { x: 1, y: 2, width: 3, height: 4 },
  };
  const bundle = await buildAnnotationBundle({ pick, changes: [], omitScreenshot: true });
  expect(bundle.screenshotPath).toBeUndefined();
  expect(formatAnnotationMarkdown(bundle)).toContain("Pricing Card (Pro)");
  expect(formatAnnotationMarkdown(bundle)).toContain("PricingCard.tsx:31:4");
});
