import { beforeEach, expect, test, vi } from "vitest";
import type { AnnotationControlDefinition } from "@skyloupe/core";
import { readControls } from "@skyloupe/core/validators";
import { resetSurfaceState } from "../../core/src/surfaceGuard";
import { installPolyfill, resetDevtools } from "../src/polyfill/installPolyfill";
import { pickAt } from "../src/polyfill/picker";
import { scanDiagnostics } from "../src/overlay/diagnosticsDrawer";

beforeEach(() => {
  resetDevtools();
  resetSurfaceState();
  document.body.replaceChildren();
  setGesture(false);
});

function setGesture(active: boolean) {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { isActive: active, hasBeenActive: active },
  });
}

function place(tag = "div") {
  const element = document.createElement(tag);
  element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20, toJSON() { return {}; } }) as DOMRect;
  document.body.append(element);
  return element;
}

function api() {
  installPolyfill();
  const annotation = document.oai?.annotation;
  if (!annotation) throw new Error("missing polyfill");
  return annotation;
}

test("OAI-ENV-001 installs on localhost and throws for an iframe surface", () => {
  const ready = vi.fn();
  document.addEventListener("skyloupe:polyfill-ready", ready);
  expect(installPolyfill()).toBe("polyfill-standalone");
  expect(ready).toHaveBeenCalledOnce();
  expect(installPolyfill()).toBe("polyfill-standalone");
  expect(ready).toHaveBeenCalledOnce();
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const child = iframe.contentDocument?.createElement("div");
  iframe.contentDocument?.body.append(child!);
  expect(() => api().registerSurface({ element: child!, hitTest: () => null })).toThrow("OAI-ENV-001");
});

test("OAI-ENV-001 leaves a native API and an uninjectable document alone", async () => {
  const native = {
    isActive: () => false,
    toggle: () => ({ accepted: false }),
    request: () => ({ accepted: false }),
    registerControls: () => ({ update() {}, dispose() {} }),
    registerSurface: () => ({ invalidate() {}, dispose() {} }),
  };
  document.oai = { annotation: native };
  const ready = vi.fn();
  document.addEventListener("skyloupe:polyfill-ready", ready);
  expect(installPolyfill()).toBe("native-companion");
  expect(installPolyfill({ inspector: false })).toBe("native-passthrough");
  expect(document.oai.annotation).toBe(native);
  expect(ready).not.toHaveBeenCalled();
  document.removeEventListener("skyloupe:polyfill-ready", ready);

  resetDevtools();
  const runtime = await import("@skyloupe/core");
  const guard = vi.spyOn(runtime, "canInjectAnnotationApi").mockReturnValue(false);
  expect(installPolyfill()).toBe("native-passthrough");
  expect(document.oai?.annotation).toBeUndefined();
  guard.mockRestore();
});

test("OAI-DOM-001 warns for an isolated annotatable and stays quiet inside a container", () => {
  const orphan = place();
  orphan.setAttribute("oai-annotatable", "Orphan");
  const box = place();
  box.setAttribute("oai-annotation-container", "");
  const card = document.createElement("article");
  card.setAttribute("oai-annotatable", "Card");
  box.append(card);
  const codes = scanDiagnostics().map((item) => item.code);
  expect(codes).toContain("OAI-DOM-001");
  expect(scanDiagnostics().filter((item) => item.target?.includes("Card"))).toEqual([]);
});

test("OAI-DOM-002 prefers text selection inside container-text", async () => {
  const text = place("p");
  text.setAttribute("oai-annotation-container-text", "");
  text.textContent = "Hello world";
  const range = document.createRange();
  range.selectNodeContents(text);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  document.elementFromPoint = () => text;
  const pick = await pickAt(4, 4);
  expect(pick?.kind).toBe("text-range");
  if (pick?.kind === "text-range") expect(pick.selectedText).toContain("Hello");
});

test("OAI-META-001 and OAI-META-002 report ignored metadata and accept a flat object", () => {
  const bad = place();
  bad.setAttribute("oai-annotation-metadata", JSON.stringify({ nested: { a: 1 } }));
  const spaced = place();
  spaced.setAttribute("oai-annotation-metadata", JSON.stringify({ "two  spaces": "x" }));
  expect(scanDiagnostics().map((item) => item.code)).toEqual(expect.arrayContaining(["OAI-META-001", "OAI-META-002"]));
  const good = place();
  good.id = "good";
  good.setAttribute("oai-annotation-container", "");
  good.setAttribute("oai-annotation-metadata", JSON.stringify({ planId: "Pro" }));
  expect(scanDiagnostics().some((item) => item.target?.includes("#good"))).toBe(false);
});

test("OAI-REQ-001 and OAI-REQ-002 return accepted false without throwing", () => {
  const annotation = api();
  expect(annotation.toggle(true)).toEqual({ accepted: false });
  expect(annotation.request(place())).toEqual({ accepted: false });
  setGesture(true);
  expect(annotation.request(place(), { initialComment: "x".repeat(241) })).toEqual({ accepted: false });
  const range = document.createRange();
  range.selectNodeContents(place());
  expect(annotation.request(range, { mode: "advanced" })).toEqual({ accepted: false });
  expect(annotation.request(place())).toEqual({ accepted: true });
});

test("OAI-CTRL-001 throws for the 65th registration and allows a valid one", () => {
  const annotation = api();
  const element = place();
  for (let i = 0; i < 64; i += 1) {
    annotation.registerControls({ targets: [element], controls: [{ type: "toggle", label: "On", callback: `setOn${i}` }] });
  }
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "toggle", label: "On", callback: "setOverflow" }],
  })).toThrow("OAI-CTRL-001");
});

test("OAI-CTRL-002 throws for an extra field and accepts a single toggle", () => {
  const annotation = api();
  const element = place();
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "toggle", label: "On", callback: "setOn", extra: true } as unknown as AnnotationControlDefinition],
  })).toThrow("OAI-CTRL-002");
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "toggle", label: "On", callback: "setOn" }],
  })).not.toThrow();
});

test("OAI-CTRL-003 throws for a bidi label and accepts a trimmed heading", () => {
  const annotation = api();
  const element = place();
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "toggle", label: "Go\u202E", callback: "setOn" }],
  })).toThrow("OAI-CTRL-003");
  const handle = annotation.registerControls({
    targets: [element],
    controlsHeading: " Card ",
    controls: [{ type: "toggle", label: "On", callback: "setOn" }],
  });
  expect(readControls(handle).controlsHeading).toBe(" Card ");
});

test("OAI-CTRL-004 throws when a reference contains a space", () => {
  const annotation = api();
  const element = place();
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "toggle", label: "On", callback: "setOn", reference: "card padding" }],
  })).toThrow("OAI-CTRL-004");
  expect(annotation.registerControls({
    targets: [element],
    controls: [{ type: "toggle", label: "On", callback: "setOn", reference: "--card-padding" }],
  }).dispose).toBeTypeOf("function");
});

test("OAI-CTRL-005 throws for a tiny step and keeps an unaligned start", () => {
  const annotation = api();
  const element = place();
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "range", label: "Pad", callback: "setPad", min: 0, max: 10, step: 0.0009 }],
  })).toThrow("OAI-CTRL-005");
  const handle = annotation.registerControls({
    targets: [element],
    controls: [{ type: "range", label: "Pad", callback: "setPad", min: 0, max: 10, step: 4, currentValue: 1 }],
  });
  expect(readControls(handle).controls[0]).toMatchObject({ currentValue: 1 });
});

test("OAI-CTRL-006 throws for a named color and fills fallbacks", () => {
  const annotation = api();
  const element = place();
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ type: "color", label: "Accent", callback: "setAccent", currentValue: "red" }],
  })).toThrow("OAI-CTRL-006");
  const handle = annotation.registerControls({
    targets: [element],
    controls: [
      { type: "color", label: "Accent", callback: "setAccent" },
      { type: "toggle", label: "On", callback: "setOn" },
    ],
  });
  expect(readControls(handle).controls[0]).toMatchObject({ currentValue: "#ffffff" });
  expect(readControls(handle).controls[1]).toMatchObject({ currentValue: false });
});

test("OAI-CTRL-007 records the select label and rejects an empty option list", () => {
  const annotation = api();
  const element = place();
  const select = {
    type: "select" as const,
    label: "Tone",
    callback: "setTone",
    options: [
      { label: "Calm", value: "calm" },
      { label: "Bold", value: "bold" },
    ],
  };
  const handle = annotation.registerControls({ targets: [element], controls: [select] });
  expect(readControls(handle).controls[0]).toMatchObject({ currentValue: "calm" });
  expect(() => annotation.registerControls({
    targets: [element],
    controls: [{ ...select, callback: "setOther", options: [] }],
  })).toThrow("OAI-CTRL-007");
});

test("OAI-CTRL-008 throws after dispose and keeps the previous registration", () => {
  const annotation = api();
  const element = place();
  const handle = annotation.registerControls({
    targets: [element],
    controlsHeading: "Keep",
    controls: [{ type: "toggle", label: "On", callback: "setOn" }],
  });
  expect(() => handle.update({ controls: [{ type: "toggle", label: "Go\u202E", callback: "setOn" }] })).toThrow("OAI-CTRL-003");
  expect(readControls(handle).controlsHeading).toBe("Keep");
  handle.dispose();
  expect(() => handle.update({ controlsHeading: "Later" })).toThrow("OAI-CTRL-008");
});

test("OAI-SURF-001 throws for a disconnected element and a shadow host", () => {
  const annotation = api();
  expect(() => annotation.registerSurface({ element: document.createElement("div"), hitTest: () => null })).toThrow("OAI-SURF-001");
  const host = place();
  const inner = document.createElement("canvas");
  host.attachShadow({ mode: "open" }).append(inner);
  expect(() => annotation.registerSurface({ element: inner, hitTest: () => null })).toThrow("OAI-SURF-001");
});

test("OAI-SURF-002 records a deadlock warning and the next pick falls back to the DOM", async () => {
  vi.useFakeTimers();
  const annotation = api();
  const canvas = place("canvas");
  let calls = 0;
  annotation.registerSurface({
    element: canvas,
    hitTest: () => {
      calls += 1;
      return new Promise(() => undefined);
    },
  });
  const card = place("article");
  document.elementFromPoint = () => card;
  const first = pickAt(2, 2);
  await vi.advanceTimersByTimeAsync(250);
  await expect(first).resolves.toMatchObject({ kind: "element", element: card });
  expect(scanDiagnostics().some((item) => item.code === "OAI-SURF-002" && item.message === "deadlock")).toBe(true);
  const second = await pickAt(3, 3);
  expect(second?.kind).toBe("element");
  expect(calls).toBe(1);
  vi.useRealTimers();
});

test("OAI-MODE-001 updates isActive before the event and lets Space clicks through", () => {
  const annotation = api();
  setGesture(true);
  let seen = false;
  let events = 0;
  const onMode = () => {
    events += 1;
    seen = annotation.isActive();
  };
  document.addEventListener("oaiannotationmodechange", onMode);
  annotation.toggle(true);
  annotation.toggle(true);
  document.removeEventListener("oaiannotationmodechange", onMode);
  expect(seen).toBe(true);
  expect(events).toBe(1);

  const button = place("button");
  let clicks = 0;
  button.addEventListener("click", () => {
    clicks += 1;
  });
  button.click();
  expect(clicks).toBe(0);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true }));
  button.click();
  expect(clicks).toBe(1);
  expect(annotation.isActive()).toBe(true);

  const overlay = document.createElement("skyloupe-devtools-host");
  const inner = document.createElement("button");
  overlay.attachShadow({ mode: "open" }).append(inner);
  document.body.append(overlay);
  let overlayClicks = 0;
  inner.addEventListener("click", () => {
    overlayClicks += 1;
  });
  document.dispatchEvent(new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true }));
  inner.click();
  expect(overlayClicks).toBe(1);
});
