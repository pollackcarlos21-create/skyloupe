import { useRef, useState } from "react";
import { Annotatable, useAnnotationControls } from "@skyloupe/react";

export const recordedRadius = 8;
export const recordedAccent = "#2563eb";

export function PricingCard({
  planId,
  price,
  featured,
  features,
  text,
}: {
  planId: string;
  price: number;
  featured?: boolean;
  features: readonly [string, string, string];
  text: {
    heading: string;
    padding: string;
    radius: string;
    accent: string;
    tone: string;
    perMonth: string;
    trial: string;
    sales: string;
  };
}) {
  const ref = useRef<HTMLElement>(null);
  const [tone, setTone] = useState<"trial" | "sales">("trial");
  const tones = [
    { label: text.trial, value: "trial" },
    { label: text.sales, value: "sales" },
  ];
  useAnnotationControls(ref, {
    controlsHeading: text.heading,
    controls: [
      {
        type: "range",
        label: text.padding,
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
        label: text.radius,
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
        label: text.accent,
        callback: `set${planId}Accent`,
        reference: "--card-accent",
        cssVar: "--card-accent",
        currentValue: recordedAccent,
      },
      {
        type: "select",
        label: text.tone,
        callback: `set${planId}Tone`,
        options: tones,
        currentValue: tone,
        onApply: (value) => {
          if (value === "trial" || value === "sales") setTone(value);
        },
      },
    ],
  });
  const label = tones.find((item) => item.value === tone)?.label ?? text.trial;
  return (
    <Annotatable
      as="article"
      ref={ref}
      className="card"
      name={`Pricing Card (${planId})`}
      metadata={{ planId, monthlyPrice: price }}
    >
      <div className="title-row">
        <h2>{planId}</h2>
        {featured ? <span className="dot" /> : null}
      </div>
      <p className="price"><strong>${price}</strong> {text.perMonth}</p>
      <ul>
        {features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
      <button className="cta" type="button">{label}</button>
    </Annotatable>
  );
}
