import { beforeEach, expect, test } from "vitest";
import { canInjectAnnotationApi, isSecureTopLocation } from "../src/runtime";
import {
  bindAnnotationGuards,
  consumeMetadata,
  diagnoseAnnotatable,
  isAnnotationActive,
  metadataIgnoredForTarget,
  readControls,
  registerControls,
  registerSurface,
  requestAnnotation,
  resetCoreState,
  resolveAnnotationGesture,
  selectTransport,
  toggleAnnotation,
} from "../src/validators";
import type { AnnotationControlDefinition } from "../src/types";

beforeEach(() => {
  resetCoreState();
  document.body.replaceChildren();
  setGesture(false);
});

function setGesture(active: boolean) {
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    value: { isActive: active, hasBeenActive: active },
  });
}

function place(element: HTMLElement) {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 20,
      bottom: 20,
      width: 20,
      height: 20,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

function toggleControl(callback = "setEnabled"): AnnotationControlDefinition {
  return { type: "toggle", label: "Enabled", callback };
}

function targets(count: number) {
  return Array.from({ length: count }, () => place(document.createElement("div")));
}

test("OAI-ENV-001 accepts https and localhost top documents", () => {
  expect(isSecureTopLocation("https:", "example.com", true)).toBe(true);
  expect(isSecureTopLocation("http:", "localhost", true)).toBe(true);
  expect(isSecureTopLocation("http:", "127.0.0.1", true)).toBe(true);
  expect(canInjectAnnotationApi()).toBe(true);
  const handle = registerSurface({ element: place(document.createElement("div")), hitTest: () => null });
  handle.dispose();
});

test("OAI-ENV-001 does not inject on an insecure or framed host", () => {
  expect(isSecureTopLocation("http:", "evil.example", true)).toBe(false);
  expect(isSecureTopLocation("https:", "example.com", false)).toBe(false);
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const child = iframe.contentDocument;
  expect(child).toBeTruthy();
  const element = child?.createElement("div");
  child?.body.appendChild(element!);
  expect(() => registerSurface({ element: element!, hitTest: () => null })).toThrow("OAI-ENV-001");
});

test("OAI-DOM-001 warns and leaves an isolated annotatable ineffective", () => {
  const lone = place(document.createElement("div"));
  lone.setAttribute("oai-annotatable", "");
  expect(diagnoseAnnotatable(lone)).toEqual([
    { code: "OAI-DOM-001", message: "isolated", field: "oai-annotatable", severity: "warning" },
  ]);
  const box = place(document.createElement("section"));
  box.setAttribute("oai-annotation-container", "");
  const child = document.createElement("div");
  child.setAttribute("oai-annotatable", "");
  box.appendChild(child);
  expect(diagnoseAnnotatable(child)).toEqual([]);
});

test("OAI-DOM-002 prefers container-text and the nearest container", () => {
  const both = place(document.createElement("div"));
  both.setAttribute("oai-annotation-container", "");
  both.setAttribute("oai-annotation-container-text", "");
  expect(resolveAnnotationGesture(both)).toBe("text");
  const outer = place(document.createElement("div"));
  outer.setAttribute("oai-annotation-container-text", "");
  const inner = document.createElement("div");
  inner.setAttribute("oai-annotation-container", "");
  const target = document.createElement("span");
  inner.appendChild(target);
  outer.appendChild(inner);
  expect(resolveAnnotationGesture(target)).toBe("element");
});

test("OAI-META-001 ignores a seventh key, a nested array, and a nested object", () => {
  const seven: Record<string, number> = {};
  for (const key of ["a", "b", "c", "d", "e", "f", "g"]) seven[key] = 1;
  expect(consumeMetadata(seven)).toMatchObject({ diagnostics: [{ code: "OAI-META-001", severity: "error" }] });
  expect(consumeMetadata(seven).metadata).toBeUndefined();
  expect(consumeMetadata({ items: [1] }).diagnostics[0]?.code).toBe("OAI-META-001");
  expect(consumeMetadata({ profile: { name: "Ada" } }).diagnostics[0]?.code).toBe("OAI-META-001");
  expect(() => consumeMetadata({ items: [1] })).not.toThrow();
  const kept = consumeMetadata({ planId: "Pro", monthlyPrice: 29, featured: true, note: null });
  expect(kept.diagnostics).toEqual([]);
  expect(kept.metadata).toEqual({ planId: "Pro", monthlyPrice: 29, featured: true, note: null });
});

test("OAI-META-002 ignores a double-spaced key, a long string, and an oversized payload", () => {
  expect(consumeMetadata({ "a  b": 1 }).diagnostics[0]?.code).toBe("OAI-META-002");
  expect(consumeMetadata({ "card padding": 20 }).metadata).toEqual({ "card padding": 20 });
  expect(consumeMetadata({ a: "x".repeat(257) }).diagnostics[0]?.code).toBe("OAI-META-002");
  const big = "字".repeat(200);
  const payload: Record<string, string> = {};
  for (const key of ["a", "b", "c", "d", "e", "f"]) payload[key] = big;
  expect(consumeMetadata(payload).metadata).toBeUndefined();
  expect(consumeMetadata(payload).diagnostics[0]?.code).toBe("OAI-META-002");
});

test("OAI-REQ-001 returns accepted false outside a gesture or while a request is open", () => {
  const element = place(document.createElement("div"));
  expect(requestAnnotation(element)).toEqual({ accepted: false });
  expect(toggleAnnotation(true)).toEqual({ accepted: false });
  setGesture(true);
  expect(requestAnnotation(element)).toEqual({ accepted: true });
  expect(requestAnnotation(element)).toEqual({ accepted: false });
  expect(() => requestAnnotation(element)).not.toThrow();
});

test("OAI-REQ-001 accepts one toggle during an active user gesture", () => {
  setGesture(true);
  expect(toggleAnnotation(true)).toEqual({ accepted: true });
  expect(isAnnotationActive()).toBe(true);
});

test("OAI-REQ-002 rejects a long comment, a disconnected element, and an advanced range", () => {
  setGesture(true);
  const element = place(document.createElement("div"));
  expect(requestAnnotation(element, { initialComment: "a".repeat(240) }).accepted).toBe(true);
  resetCoreState();
  setGesture(true);
  expect(requestAnnotation(element, { initialComment: "a".repeat(241) })).toEqual({ accepted: false });
  expect(requestAnnotation(document.createElement("div"))).toEqual({ accepted: false });
  const paragraph = place(document.createElement("p"));
  paragraph.textContent = "visible text";
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.getBoundingClientRect = () => paragraph.getBoundingClientRect();
  expect(requestAnnotation(range, { mode: "advanced" })).toEqual({ accepted: false });
  expect(metadataIgnoredForTarget(range)).toBe(true);
});

test("OAI-REQ-002 accepts a visible range and ignores metadata inside shadow DOM", () => {
  setGesture(true);
  const paragraph = place(document.createElement("p"));
  paragraph.textContent = "visible text";
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.getBoundingClientRect = () => paragraph.getBoundingClientRect();
  expect(requestAnnotation(range, { metadata: { planId: "Pro" } })).toEqual({ accepted: true });
  resetCoreState();
  setGesture(true);
  const host = place(document.createElement("div"));
  const shadow = host.attachShadow({ mode: "open" });
  const inner = document.createElement("span");
  inner.getBoundingClientRect = () => host.getBoundingClientRect();
  shadow.appendChild(inner);
  expect(metadataIgnoredForTarget(inner)).toBe(true);
  expect(requestAnnotation(inner, { metadata: { planId: "Pro" } }).accepted).toBe(true);
  const closedHost = place(document.createElement("div"));
  const closed = closedHost.attachShadow({ mode: "closed" });
  const secret = document.createElement("span");
  secret.textContent = "secret";
  closed.appendChild(secret);
  const hidden = document.createRange();
  hidden.selectNodeContents(secret);
  hidden.getBoundingClientRect = () => closedHost.getBoundingClientRect();
  expect(requestAnnotation(hidden)).toEqual({ accepted: false });
});

test("OAI-CTRL-001 rejects the 65th registration, the 1025th target, and an empty target list", () => {
  const element = place(document.createElement("div"));
  for (let index = 0; index < 64; index += 1) {
    registerControls({ targets: [element], controls: [toggleControl(`setItem${index}`)] });
  }
  expect(() => registerControls({ targets: [element], controls: [toggleControl("setExtra")] })).toThrow("OAI-CTRL-001");
  resetCoreState();
  const many = targets(128);
  for (let index = 0; index < 8; index += 1) {
    registerControls({ targets: many, controls: [toggleControl(`setGroup${index}`)] });
  }
  expect(() => registerControls({ targets: [many[0]!], controls: [toggleControl("setOver")] })).toThrow("OAI-CTRL-001");
  resetCoreState();
  expect(() => registerControls({ targets: [], controls: [toggleControl()] })).toThrow("OAI-CTRL-001");
  expect(() => registerControls({ targets: targets(129), controls: [toggleControl()] })).toThrow("OAI-CTRL-001");
});

test("OAI-CTRL-001 allows update to unbind every target", () => {
  const handle = registerControls({ targets: [place(document.createElement("div"))], controls: [toggleControl()] });
  handle.update({ targets: [] });
  expect(readControls(handle).targets).toHaveLength(0);
});

test("OAI-CTRL-002 rejects duplicate callbacks, extra fields, too many controls, and a huge payload", () => {
  const element = place(document.createElement("div"));
  expect(() =>
    registerControls({
      targets: [element],
      controls: [toggleControl(), toggleControl()],
    }),
  ).toThrow("OAI-CTRL-002");
  expect(() =>
    registerControls({
      targets: [element],
      controls: [{ ...toggleControl(), extra: true } as unknown as AnnotationControlDefinition],
    }),
  ).toThrow("OAI-CTRL-002");
  expect(() =>
    registerControls({
      targets: [element],
      controls: Array.from({ length: 13 }, (_, index) => toggleControl(`setN${index}`)),
    }),
  ).toThrow("OAI-CTRL-002");
  const options = Array.from({ length: 12 }, (_, index) => ({
    label: "Option",
    value: `${index}`.padEnd(512, "v"),
  }));
  expect(() =>
    registerControls({
      targets: [element],
      controls: Array.from({ length: 4 }, (_, index) => ({
        type: "select" as const,
        label: "Choice",
        callback: `setChoice${index}`,
        options,
      })),
    }),
  ).toThrow("OAI-CTRL-002");
});

test("OAI-CTRL-003 rejects a bidi label and accepts a trimmed heading", () => {
  const element = place(document.createElement("div"));
  expect(() =>
    registerControls({
      targets: [element],
      controls: [{ ...toggleControl(), label: "Go\u202E" }],
    }),
  ).toThrow("OAI-CTRL-003");
  const handle = registerControls({
    targets: [element],
    controlsHeading: "Appearance",
    controls: [toggleControl()],
  });
  expect(readControls(handle).controlsHeading).toBe("Appearance");
});

test("OAI-CTRL-004 rejects a reference that contains a space", () => {
  const element = place(document.createElement("div"));
  expect(() =>
    registerControls({
      targets: [element],
      controls: [{ ...toggleControl(), reference: "card padding" }],
    }),
  ).toThrow("OAI-CTRL-004");
  const handle = registerControls({
    targets: [element],
    controls: [{ ...toggleControl(), reference: "--card-padding" }],
  });
  expect(readControls(handle).controls[0]?.reference).toBe("--card-padding");
});

test("OAI-CTRL-005 rejects a bad step and keeps a start value that is not on the step", () => {
  const element = place(document.createElement("div"));
  expect(() =>
    registerControls({
      targets: [element],
      controls: [{ type: "range", label: "Pad", callback: "setPad", min: 0, max: 10, step: 0.0009 }],
    }),
  ).toThrow("OAI-CTRL-005");
  const handle = registerControls({
    targets: [element],
    controls: [{ type: "range", label: "Pad", callback: "setPad", min: 0, max: 10, step: 4, currentValue: 1 }],
  });
  expect(readControls(handle).controls[0]).toMatchObject({ currentValue: 1, defaultValue: 0 });
});

test("OAI-CTRL-006 rejects a named color and a non-boolean toggle, and applies fallbacks", () => {
  const element = place(document.createElement("div"));
  expect(() =>
    registerControls({
      targets: [element],
      controls: [{ type: "color", label: "Accent", callback: "setAccent", currentValue: "red" }],
    }),
  ).toThrow("OAI-CTRL-006");
  expect(() =>
    registerControls({
      targets: [element],
      controls: [{ type: "toggle", label: "On", callback: "setOn", currentValue: "yes" } as never],
    }),
  ).toThrow("OAI-CTRL-006");
  const handle = registerControls({
    targets: [element],
    controls: [
      { type: "color", label: "Accent", callback: "setAccent" },
      { type: "toggle", label: "On", callback: "setOn" },
    ],
  });
  expect(readControls(handle).controls[0]).toMatchObject({ currentValue: "#ffffff" });
  expect(readControls(handle).controls[1]).toMatchObject({ currentValue: false });
});

test("OAI-CTRL-007 sends option.value to preview and option.label to the record", () => {
  const select = {
    type: "select" as const,
    label: "Tone",
    callback: "setTone",
    options: [
      { label: "Calm", value: "calm" },
      { label: "Bold", value: "bold" },
    ],
  };
  expect(selectTransport(select)).toEqual({
    preview: "calm",
    record: "Calm",
    unchangedExplicitChoice: true,
  });
  expect(selectTransport({ ...select, currentValue: "bold" })).toEqual({
    preview: "bold",
    record: "Bold",
    unchangedExplicitChoice: false,
  });
  const handle = registerControls({ targets: [place(document.createElement("div"))], controls: [select] });
  expect(readControls(handle).controls[0]).toMatchObject({ currentValue: "calm" });
  expect(() => selectTransport({ ...select, options: [] })).toThrow("OAI-CTRL-007");
});

test("OAI-CTRL-008 throws after dispose and keeps the previous registration when update fails", () => {
  const element = place(document.createElement("div"));
  const handle = registerControls({
    targets: [element],
    controlsHeading: "Keep",
    controls: [toggleControl()],
  });
  expect(() =>
    handle.update({
      targets: [],
      controlsHeading: "Next",
      controlsMode: "extend",
      controls: [{ ...toggleControl(), label: "Go\u202E" }],
    }),
  ).toThrow("OAI-CTRL-003");
  expect(readControls(handle)).toMatchObject({
    controlsHeading: "Keep",
    targets: [element],
    controls: [expect.objectContaining({ callback: "setEnabled", currentValue: false })],
  });
  expect(readControls(handle).controlsMode).toBeUndefined();
  handle.dispose();
  expect(() => handle.update({ controlsHeading: "Later" })).toThrow("OAI-CTRL-008");
});

test("OAI-SURF-001 throws for a disconnected element and a shadow host", () => {
  expect(() => registerSurface({ element: document.createElement("div"), hitTest: () => null })).toThrow("OAI-SURF-001");
  const host = place(document.createElement("div"));
  const shadow = host.attachShadow({ mode: "open" });
  const inner = document.createElement("div");
  shadow.appendChild(inner);
  expect(() => registerSurface({ element: inner, hitTest: () => null })).toThrow("OAI-SURF-001");
});

test("OAI-MODE-001 updates isActive before the event and does not repeat toggle(true)", () => {
  setGesture(true);
  let seen = false;
  let events = 0;
  const onMode = () => {
    events += 1;
    seen = isAnnotationActive();
  };
  document.addEventListener("oaiannotationmodechange", onMode);
  toggleAnnotation(true);
  toggleAnnotation(true);
  document.removeEventListener("oaiannotationmodechange", onMode);
  expect(seen).toBe(true);
  expect(events).toBe(1);
  expect(isAnnotationActive()).toBe(true);
});

test("OAI-MODE-001 lets clicks through while Space is held", () => {
  const release = bindAnnotationGuards();
  const button = place(document.createElement("button"));
  let clicks = 0;
  button.addEventListener("click", () => {
    clicks += 1;
  });
  setGesture(true);
  toggleAnnotation(true);
  button.click();
  expect(clicks).toBe(0);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
  button.click();
  expect(clicks).toBe(1);
  expect(isAnnotationActive()).toBe(true);
  release();
});
