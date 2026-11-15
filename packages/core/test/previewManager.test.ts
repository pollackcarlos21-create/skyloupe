import { expect, test } from "vitest";
import { createPreviewManager } from "../src/previewManager";

test("preview snapshots the inline baseline, compare restores it, and reset clears it", () => {
  const element = document.createElement("article");
  element.setAttribute("style", "color: red");
  document.body.appendChild(element);
  const manager = createPreviewManager();
  const binding = { callback: "setCardPadding", cssVar: "--card-padding", unit: "px" };
  const applied: string[] = [];
  manager.apply(
    { action: "preview", callback: "setCardPadding", value: 28 },
    element,
    { ...binding, onApply: (value) => applied.push(String(value)) },
  );
  expect(element.style.getPropertyValue("--card-padding")).toBe("28px");
  expect(element.style.getPropertyValue("color")).toBe("red");
  expect(applied).toEqual(["28"]);
  manager.apply({ action: "preview-original", callback: "setCardPadding", value: 28 }, element, binding);
  expect(element.style.getPropertyValue("--card-padding")).toBe("");
  expect(element.getAttribute("style")).toBe("color: red");
  manager.apply({ action: "preview", callback: "setCardPadding", value: 32 }, element, binding);
  expect(element.style.getPropertyValue("--card-padding")).toBe("32px");
  manager.apply({ action: "reset", callback: "setCardPadding", value: 32 }, element, binding);
  expect(element.getAttribute("style")).toBe("color: red");
  manager.dispose(element);
  expect(element.getAttribute("style")).toBe("color: red");
});

test("dispose restores a style attribute that was absent before the first preview", () => {
  const element = document.createElement("article");
  document.body.appendChild(element);
  const manager = createPreviewManager();
  const binding = { callback: "setAccent", cssVar: "--card-accent" };
  manager.apply({ action: "preview", callback: "setAccent", value: "#0f766e" }, element, binding);
  expect(element.style.getPropertyValue("--card-accent")).toBe("#0f766e");
  manager.dispose(element);
  expect(element.hasAttribute("style")).toBe(false);
});
