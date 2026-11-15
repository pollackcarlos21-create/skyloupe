import { mountDevtools } from "../../src/index";

mountDevtools();

const api = document.oai?.annotation;
const card = document.querySelector("#card");
const canvas = document.querySelector("#chart");
if (!api || !(card instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error("fixture missing polyfill");
}

api.registerControls({
  targets: [card],
  controlsHeading: "Card appearance",
  controls: [
    {
      type: "range",
      label: "Card padding",
      callback: "setCardPadding",
      reference: "--card-padding",
      min: 8,
      max: 40,
      step: 4,
      currentValue: 20,
    },
    {
      type: "color",
      label: "Accent color",
      callback: "setAccentColor",
      reference: "--card-accent",
      currentValue: "#2563eb",
    },
    {
      type: "select",
      label: "Density",
      callback: "setDensity",
      options: [
        { label: "Compact", value: "compact" },
        { label: "Comfy", value: "comfy" },
      ],
      currentValue: "compact",
    },
    { type: "toggle", label: "Shadow", callback: "setShadow", currentValue: false },
  ],
});

const context = canvas.getContext("2d");
if (context) {
  context.fillStyle = "#d97706";
  context.fillRect(20, 30, 50, 60);
  context.fillStyle = "#0f766e";
  context.fillRect(110, 20, 50, 70);
}

api.registerSurface({
  element: canvas,
  hitTest(args) {
    const box = canvas.getBoundingClientRect();
    const x = args.clientX - box.left;
    const y = args.clientY - box.top;
    const bars = [
      { id: "q3", name: "Q3", x: 20, y: 30, width: 50, height: 60 },
      { id: "q4", name: "Q4", x: 110, y: 20, width: 50, height: 70 },
    ];
    const found = bars.find((bar) => x >= bar.x && y >= bar.y && x < bar.x + bar.width && y < bar.y + bar.height);
    if (!found) return null;
    return {
      id: found.id,
      name: found.name,
      rect: { x: box.left + found.x, y: box.top + found.y, width: found.width, height: found.height },
    };
  },
});
