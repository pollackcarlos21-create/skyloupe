import { expect, test } from "vitest";
import { applyAnnotation } from "../src/mockBridge";

test("the mocked send writes the requested token onto the card", () => {
  const card = document.createElement("article");
  applyAnnotation(card, { controlChanges: [{ reference: "--card-padding", requestedValue: 40 }, { reference: "--card-accent", requestedValue: "#0f766e" }] });
  expect(card.style.getPropertyValue("--card-padding")).toBe("40px");
  expect(card.style.getPropertyValue("--card-accent")).toBe("#0f766e");
  expect(card.dataset.applied).toBe("true");
});
