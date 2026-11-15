import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, useRef, type ReactNode } from "react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { RegisterSurfaceConfig, UpdateControlsConfig } from "@skyloupe/core";
import { resetSurfaceState } from "../../core/src/surfaceGuard";
import { readControls, registerControls, registerSurface, resetCoreState } from "../../core/src/validators";
import { Annotatable, AnnotatableCanvas, AnnotationContainer } from "../src/index";
import { useAnnotationControls } from "../src/useAnnotationControls";

beforeEach(() => {
  resetCoreState();
  resetSurfaceState();
  document.body.replaceChildren();
  installApi();
});

afterEach(() => {
  document.body.replaceChildren();
  resetCoreState();
  resetSurfaceState();
});

function installApi(register = registerControls) {
  document.oai = {
    annotation: {
      isActive: () => false,
      toggle: () => ({ accepted: false }),
      request: () => ({ accepted: false }),
      registerControls: register,
      registerSurface,
    },
  };
}

function probe() {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return element;
}

function takenSlots(prefix: string): number {
  const element = probe();
  let made = 0;
  for (let i = 0; i < 64; i += 1) {
    try {
      registerControls({
        targets: [element],
        controls: [{ type: "toggle", label: "On", callback: `${prefix}${i}` }],
      });
      made += 1;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "OAI-CTRL-001") throw error;
      break;
    }
  }
  return made;
}

async function mount(node: ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return {
    host,
    root,
    async render(next: ReactNode) {
      await act(async () => {
        root.render(next);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
  };
}

function paddingControl(currentValue: number) {
  return {
    type: "range" as const,
    label: "Card padding",
    callback: "setCardPadding",
    reference: "--card-padding",
    cssVar: "--card-padding",
    unit: "px",
    min: 8,
    max: 40,
    step: 4,
    currentValue,
  };
}

function Padded({ value }: { value: number }) {
  const ref = useRef<HTMLElement>(null);
  useAnnotationControls(ref, { controlsHeading: "Card appearance", controls: [paddingControl(value)] });
  return <article ref={ref} id="card" style={{ color: "red" }} />;
}

test("unmount during preview restores the CSS variable and frees a registration slot", async () => {
  let disposeSawBaseline = false;
  let listenerGoneAtDispose = false;
  let card: HTMLElement | null = null;
  let baseline: string | null = null;
  installApi((config) => {
    const handle = registerControls(config);
    const dispose = handle.dispose.bind(handle);
    handle.dispose = () => {
      disposeSawBaseline = card?.getAttribute("style") === baseline;
      card?.dispatchEvent(
        new CustomEvent("oaiannotationcontrolchange", {
          detail: { callback: "setCardPadding", value: 32, action: "preview" },
        }),
      );
      listenerGoneAtDispose = card?.getAttribute("style") === baseline;
      dispose();
    };
    return handle;
  });
  const view = await mount(<Padded value={20} />);
  card = document.getElementById("card");
  expect(card).toBeTruthy();
  baseline = card?.getAttribute("style") ?? null;
  card?.dispatchEvent(
    new CustomEvent("oaiannotationcontrolchange", {
      detail: { callback: "setCardPadding", value: 28, action: "preview" },
    }),
  );
  expect(card?.style.getPropertyValue("--card-padding")).toBe("28px");
  expect(takenSlots("hold")).toBe(63);
  await view.unmount();
  expect(disposeSawBaseline).toBe(true);
  expect(listenerGoneAtDispose).toBe(true);
  expect(card?.getAttribute("style")).toBe(baseline);
  expect(card?.style.getPropertyValue("--card-padding")).toBe("");
  expect(document.getElementById("card")).toBeNull();
  expect(takenSlots("free")).toBe(1);
  expect(() =>
    registerControls({
      targets: [probe()],
      controls: [{ type: "toggle", label: "On", callback: "setOverflow" }],
    }),
  ).toThrow("OAI-CTRL-001");
});

test("re-render that swaps the DOM node calls update({ targets })", async () => {
  const updates: UpdateControlsConfig[] = [];
  let registrations = 0;
  installApi((config) => {
    registrations += 1;
    const handle = registerControls(config);
    const update = handle.update.bind(handle);
    handle.update = (next) => {
      updates.push(next);
      update(next);
    };
    return handle;
  });
  function Swap({ tag }: { tag: "article" | "section" }) {
    const ref = useRef<HTMLElement>(null);
    useAnnotationControls(ref, { controls: [{ type: "toggle", label: "On", callback: "setOn" }] });
    return tag === "article" ? <article ref={ref} id="a" /> : <section ref={ref} id="b" />;
  }
  const view = await mount(<Swap tag="article" />);
  expect(registrations).toBe(1);
  expect(updates).toEqual([]);
  await view.render(<Swap tag="section" />);
  expect(registrations).toBe(1);
  const targets = updates.at(-1)?.targets;
  expect(targets).toBeTruthy();
  const next = Array.from(targets as ArrayLike<Element>);
  expect(next.map((element) => element.id)).toEqual(["b"]);
});

test("currentValue changes call update({ controls })", async () => {
  const updates: UpdateControlsConfig[] = [];
  let handle: ReturnType<typeof registerControls> | undefined;
  installApi((config) => {
    handle = registerControls(config);
    const update = handle.update.bind(handle);
    handle.update = (next) => {
      updates.push(next);
      update(next);
    };
    return handle;
  });
  const view = await mount(<Padded value={20} />);
  expect(updates).toEqual([]);
  expect(handle && readControls(handle).controls[0]?.currentValue).toBe(20);
  await view.render(<Padded value={32} />);
  expect(updates).toHaveLength(1);
  expect(updates[0]?.controls?.[0]).toMatchObject({ type: "range", callback: "setCardPadding", currentValue: 32 });
  expect(updates[0]?.controls?.[0]).not.toHaveProperty("cssVar");
  expect(updates[0]?.controls?.[0]).not.toHaveProperty("unit");
  expect(handle && readControls(handle).controls[0]?.currentValue).toBe(32);
});

test("registers when skyloupe:polyfill-ready fires after mount", async () => {
  let calls = 0;
  document.oai = undefined;
  function Card() {
    const ref = useRef<HTMLElement>(null);
    useAnnotationControls(ref, { controls: [{ type: "toggle", label: "On", callback: "setOn" }] });
    return <article ref={ref} />;
  }
  await mount(<Card />);
  expect(calls).toBe(0);
  installApi((config) => {
    calls += 1;
    return registerControls(config);
  });
  document.dispatchEvent(new Event("skyloupe:polyfill-ready"));
  expect(calls).toBe(1);
  expect(takenSlots("late")).toBe(63);
});

test("Annotatable warns with the source location and omits invalid metadata", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const view = await mount(
    <AnnotationContainer textSelection>
      <Annotatable
        as="article"
        name="Pricing Card"
        metadata={{ nested: { plan: "Pro" } }}
        data-skyloupe-source="src/components/PricingCard.tsx:31:4"
      />
    </AnnotationContainer>,
  );
  const article = view.host.querySelector("article");
  expect(view.host.querySelector("[oai-annotation-container-text]")).toBeTruthy();
  expect(article?.getAttribute("oai-annotatable")).toBe("Pricing Card");
  expect(article?.hasAttribute("oai-annotation-metadata")).toBe(false);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("OAI-META-001"));
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("src/components/PricingCard.tsx:31:4"));
  warn.mockRestore();
  await view.unmount();
  const valid = await mount(
    <Annotatable as="section" name="Card" metadata={{ planId: "Pro", monthlyPrice: 29 }} />,
  );
  expect(valid.host.querySelector("section")?.getAttribute("oai-annotation-metadata")).toBe(
    JSON.stringify({ planId: "Pro", monthlyPrice: 29 }),
  );
});

test("AnnotatableCanvas hit-tests virtualObjects or a custom hitTest and routes to the captured virtualTarget.targetId", async () => {
  let surface: RegisterSurfaceConfig | undefined;
  installApi();
  document.oai!.annotation!.registerSurface = (config) => {
    surface = config;
    return registerSurface(config);
  };
  const routed: string[] = [];
  const objects = [
    { id: "q3", name: "Q3", rect: { x: 100, y: 50, width: 20, height: 10 } },
    { id: "q4", name: "Q4", rect: { x: 150, y: 50, width: 20, height: 10 } },
  ];
  function Chart({ selected }: { selected: string }) {
    return (
      <AnnotatableCanvas
        virtualObjects={objects}
        data-selected={selected}
        onControlChange={(_detail, object) => {
          routed.push(object?.id ?? "");
        }}
      />
    );
  }
  const view = await mount(<Chart selected="q4" />);
  const canvas = view.host.querySelector("canvas");
  expect(canvas).toBeTruthy();
  expect(surface).toBeTruthy();
  canvas!.width = 200;
  canvas!.height = 100;
  canvas!.getBoundingClientRect = () =>
    ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 110,
      bottom: 70,
      width: 100,
      height: 50,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  await expect(surface!.hitTest({ clientX: 60, clientY: 45, signal: new AbortController().signal })).resolves.toEqual({
    id: "q3",
    name: "Q3",
    rect: { x: 60, y: 45, width: 10, height: 5 },
  });
  await expect(surface!.hitTest({ clientX: 10, clientY: 20, signal: new AbortController().signal })).resolves.toBeNull();
  canvas!.dispatchEvent(
    new CustomEvent("oaiannotationcontrolchange", {
      detail: {
        callback: "setBar",
        value: 1,
        action: "preview",
        virtualTarget: { surfaceId: "chart", targetId: "q3" },
      },
    }),
  );
  await view.render(<Chart selected="q4" />);
  canvas!.dispatchEvent(
    new CustomEvent("oaiannotationcontrolchange", {
      detail: {
        callback: "setBar",
        value: 2,
        action: "preview",
        virtualTarget: { surfaceId: "chart", targetId: "q3" },
      },
    }),
  );
  expect(routed).toEqual(["q3", "q3"]);

  let seen = { canvasX: -1, canvasY: -1 };
  surface = undefined;
  const custom = await mount(
    <AnnotatableCanvas
      hitTest={(args) => {
        seen = { canvasX: args.canvasX, canvasY: args.canvasY };
        return { id: "custom", rect: { x: args.canvasX, y: args.canvasY, width: 20, height: 10 } };
      }}
    />,
  );
  const second = custom.host.querySelector("canvas");
  second!.width = 200;
  second!.height = 100;
  second!.getBoundingClientRect = canvas!.getBoundingClientRect.bind(canvas);
  await expect(surface!.hitTest({ clientX: 60, clientY: 45, signal: new AbortController().signal })).resolves.toEqual({
    id: "custom",
    rect: { x: 60, y: 45, width: 10, height: 5 },
  });
  expect(seen).toEqual({ canvasX: 100, canvasY: 50 });
});

test("react is a peer dependency and not a third-party runtime dependency", () => {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  expect(pkg.peerDependencies?.react).toBe(">=18.0.0");
  expect(pkg.dependencies?.react).toBeUndefined();
  const thirdParty = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@skyloupe/"));
  expect(thirdParty).toEqual([]);
});
