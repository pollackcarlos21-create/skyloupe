import { useEffect, useMemo, useState } from "react";
import { AnnotatableCanvas, type VirtualObject } from "@skyloupe/react";

const WIDTH = 520;
const HEIGHT = 280;
const QUARTERS = [
  { id: "q1", name: "Q1 Revenue", value: 120, color: "#c2410c" },
  { id: "q2", name: "Q2 Revenue", value: 160, color: "#b45309" },
  { id: "q3", name: "Q3 Revenue", value: 210, color: "#0f766e" },
  { id: "q4", name: "Q4 Revenue", value: 150, color: "#1d4ed8" },
] as const;

function layout(names: readonly string[]): VirtualObject[] {
  const gap = 28;
  const barWidth = 64;
  const base = HEIGHT - 36;
  return QUARTERS.map((quarter, index) => ({
    id: quarter.id,
    name: names[index] ?? quarter.name,
    rect: {
      x: 48 + index * (barWidth + gap),
      y: base - quarter.value,
      width: barWidth,
      height: quarter.value,
    },
  }));
}

export function RevenueChart({
  names,
  colorLabel,
  radiusLabel,
  heading,
}: {
  names: readonly string[];
  colorLabel: string;
  radiusLabel: string;
  heading: string;
}) {
  const objects = useMemo(() => layout(names), [names]);
  const [style, setStyle] = useState<Record<string, { color: string; radius: number }>>(() =>
    Object.fromEntries(QUARTERS.map((quarter) => [quarter.id, { color: quarter.color, radius: 6 }])),
  );
  useEffect(() => {
    const canvas = document.getElementById("chart");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    for (const object of objects) {
      const paint = style[object.id] ?? { color: "#0f766e", radius: 6 };
      context.fillStyle = paint.color;
      context.beginPath();
      context.roundRect(object.rect.x, object.rect.y, object.rect.width, object.rect.height, paint.radius);
      context.fill();
      context.fillStyle = "#737373";
      context.font = "12px Inter, ui-sans-serif, system-ui, sans-serif";
      context.fillText(object.name?.slice(0, 2) ?? "", object.rect.x + 18, HEIGHT - 16);
    }
  }, [objects, style]);
  const selected = style.q3 ?? { color: "#0f766e", radius: 6 };
  return (
    <AnnotatableCanvas
      id="chart"
      data-skyloupe-source="src/components/RevenueChart.tsx:48:6"
      width={WIDTH}
      height={HEIGHT}
      controlsHeading={heading}
      virtualObjects={objects}
      controls={[
        { type: "color", label: colorLabel, callback: "setBarColor", currentValue: selected.color },
        {
          type: "range",
          label: radiusLabel,
          callback: "setBarRadius",
          min: 0,
          max: 16,
          step: 1,
          currentValue: selected.radius,
        },
      ]}
      onControlChange={(detail, object) => {
        const id = object?.id;
        if (!id) return;
        setStyle((current) => {
          const previous = current[id] ?? { color: "#0f766e", radius: 6 };
          if (detail.callback === "setBarColor" && typeof detail.value === "string") {
            return { ...current, [id]: { ...previous, color: detail.value } };
          }
          if (detail.callback === "setBarRadius" && typeof detail.value === "number") {
            return { ...current, [id]: { ...previous, radius: detail.value } };
          }
          return current;
        });
      }}
    />
  );
}
