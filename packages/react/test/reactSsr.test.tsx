/**
 * @vitest-environment node
 */
import { createElement, useRef } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { Annotatable, AnnotationContainer } from "../src/index";
import { useAnnotationControls } from "../src/useAnnotationControls";

function Card() {
  const ref = useRef<HTMLElement>(null);
  useAnnotationControls(ref, {
    controlsHeading: "Card appearance",
    controls: [
      {
        type: "range",
        label: "Card padding",
        callback: "setCardPadding",
        cssVar: "--card-padding",
        unit: "px",
        min: 8,
        max: 40,
        step: 4,
        currentValue: 20,
      },
    ],
  });
  return createElement(
    AnnotationContainer,
    null,
    createElement(Annotatable, { ref, as: "article", name: "Pricing Card", metadata: { planId: "Pro" } }, "Pro"),
  );
}

test("renders to string when document is missing", () => {
  expect(typeof document).toBe("undefined");
  const html = renderToString(createElement(Card));
  expect(html).toContain("oai-annotation-container");
  expect(html).toContain('oai-annotatable="Pricing Card"');
  expect(html).toContain("oai-annotation-metadata");
  expect(html).toContain("planId");
});
