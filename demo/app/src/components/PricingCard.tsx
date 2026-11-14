import { useRef, useState } from "react";
import { Annotatable, useAnnotationControls } from "@skyloupe/react";

export const recordedRadius = 8;
export const recordedAccent = "#2563eb";

const tones = [
  { label: "Start free trial", value: "trial" },
  { label: "Talk to sales", value: "sales" },
] as const;

export function PricingCard({
  planId,
  price,
  featured,
}: {
  planId: string;
  price: number;
  featured?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<(typeof tones)[number]["value"]>("trial");
  useAnnotationControls(ref, {
    controlsHeading: "Card appearance",
    controls: [
      {
        type: "range",
        label: "Card padding",
        callback: `set${planId}Padding`,
        reference: "--card-padding",
        cssVar: "--card-padding",
        unit: "px",
        min: 12,
        max: 40,
        step: 2,
        currentValue: 16,
      },
      {
        type: "range",
        label: "Card radius",
        callback: `set${planId}Radius`,
        reference: "--card-radius",
        cssVar: "--card-radius",
        unit: "px",
        min: 0,
        max: 28,
        step: 1,
        currentValue: recordedRadius,
      },
      {
        type: "color",
        label: "Accent color",
        callback: `set${planId}Accent`,
        reference: "--card-accent",
        cssVar: "--card-accent",
        currentValue: recordedAccent,
      },
      {
        type: "select",
        label: "Button tone",
        callback: `set${planId}Tone`,
        options: [...tones],
        currentValue: tone,
        onApply: (value) => {
          if (value === "trial" || value === "sales") setTone(value);
        },
      },
    ],
  });
  const label = tones.find((item) => item.value === tone)?.label ?? "Start free trial";
  return (
    <Annotatable
      as="article"
      ref={ref}
      className={featured ? "card pro" : "card"}
      name={`Pricing Card (${planId})`}
      metadata={{ planId, monthlyPrice: price }}
    >
      <h2>{planId}</h2>
      <p className="price"><strong>${price}</strong> / month</p>
      <ul>
        <li>{featured ? "Priority annotation review" : "Shared annotation inbox"}</li>
        <li>{featured ? "Canvas object controls" : "DOM element controls"}</li>
        <li>Local Codex bridge</li>
      </ul>
      <button className="cta" type="button">{label}</button>
    </Annotatable>
  );
}
