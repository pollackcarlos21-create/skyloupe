import { CALLBACK_NAME, FORBIDDEN_TEXT, HEX_COLOR, METADATA_KEY, REFERENCE_NAME, utf8Length } from "./constants";
import { canInjectAnnotationApi } from "./runtime";
import type {
  AnnotationAcceptance,
  AnnotationControlDefinition,
  AnnotationMetadata,
  AnnotationRequestOptions,
  ColorControl,
  ControlsRegistrationHandle,
  ControlsTargetInput,
  RangeControl,
  RegisterControlsConfig,
  RegisterSurfaceConfig,
  SelectControl,
  SurfaceRegistrationHandle,
  ToggleControl,
  UpdateControlsConfig,
} from "./types";

export interface Diagnostic {
  code: string;
  message: string;
  field: string;
  severity: "error" | "warning";
}

export interface SelectTransport {
  preview: string;
  record: string;
  unchangedExplicitChoice: boolean;
}

export interface ControlsSnapshot {
  targets: readonly Element[];
  controls: readonly AnnotationControlDefinition[];
  controlsHeading?: string;
  controlsMode?: "replace" | "extend";
}

export type AnnotationGesture = "element" | "text";

const BOX = "oai-annotation-container";
const TEXT = "oai-annotation-container-text";
const ANN = "oai-annotatable";
const regs: ControlsSnapshot[] = [];
const reads = new WeakMap<ControlsRegistrationHandle, () => ControlsSnapshot>();
let links = 0;
let active = false;
let pending = false;
let space = false;
let unbind: (() => void) | undefined;

function fail(code: string): never {
  throw new Error(code);
}

const issue = (code: string, field: string, severity: Diagnostic["severity"], message: string): Diagnostic => ({
  code,
  message,
  field,
  severity,
});

const doc = (): Document | undefined =>
  (globalThis as { document?: Document }).document;

const list = (value: ControlsTargetInput): Element[] =>
  value instanceof Element ? [value] : Array.from(value);

const framed = (element: Element): boolean => {
  const view = element.ownerDocument.defaultView;
  return !view || view !== view.top;
};

const seen = (rect: Pick<DOMRect, "width" | "height" | "top" | "left" | "right" | "bottom">): boolean => {
  const host = globalThis as { innerWidth?: number; innerHeight?: number };
  const width = host.innerWidth ?? 0;
  const height = host.innerHeight ?? 0;
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
};

const hot = (): boolean =>
  (globalThis as { navigator?: { userActivation?: { isActive?: boolean } } }).navigator?.userActivation?.isActive === true;

const isRange = (value: Element | Range): value is Range => value instanceof Range;

const shadow = (node: Node): boolean => node.getRootNode() instanceof ShadowRoot;

const plain = (value: string): void => {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80 || FORBIDDEN_TEXT.test(value)) fail("OAI-CTRL-003");
};

const ident = (callback: string, reference?: string): void => {
  const trimmed = callback.trim();
  if (trimmed.length < 1 || trimmed.length > 80 || !CALLBACK_NAME.test(trimmed)) fail("OAI-CTRL-004");
  if (reference !== undefined && !REFERENCE_NAME.test(reference)) fail("OAI-CTRL-004");
};

const finite = (value: number): boolean => Number.isFinite(value) && value >= -10000 && value <= 10000;

const pack = <T extends AnnotationControlDefinition>(control: T, currentValue: T["currentValue"], defaultValue: T["defaultValue"]): T => ({
  ...control,
  callback: control.callback.trim(),
  currentValue,
  defaultValue,
});

export function selectTransport(control: SelectControl): SelectTransport {
  const options = control.options;
  if (!Array.isArray(options) || options.length < 1 || options.length > 12) fail("OAI-CTRL-007");
  const seenValues = new Set<string>();
  for (const option of options) {
    plain(option.label);
    if (Object.keys(option).some((key) => key !== "label" && key !== "value")) fail("OAI-CTRL-002");
    if (typeof option.value !== "string" || option.value.length > 512 || seenValues.has(option.value)) fail("OAI-CTRL-007");
    seenValues.add(option.value);
  }
  const omitted = control.currentValue === undefined;
  const current = omitted ? options[0]?.value : control.currentValue;
  const fallback = control.defaultValue ?? options[0]?.value;
  const currentOption = options.find((option) => option.value === current);
  const defaultOption = options.find((option) => option.value === fallback);
  if (!currentOption || !defaultOption) fail("OAI-CTRL-007");
  return { preview: currentOption.value, record: currentOption.label, unchangedExplicitChoice: omitted };
}

function norm(control: AnnotationControlDefinition): AnnotationControlDefinition {
  const allow = `type,label,callback,reference,currentValue,defaultValue${control.type === "range" ? ",min,max,step" : control.type === "select" ? ",options" : ""}`.split(",");
  if (
    (control.type !== "color" && control.type !== "range" && control.type !== "select" && control.type !== "toggle") ||
    Object.keys(control).some((key) => !allow.includes(key))
  ) fail("OAI-CTRL-002");
  plain(control.label);
  ident(control.callback, control.reference);
  if (control.type === "range") return normRange(control);
  if (control.type === "color") return normColor(control);
  if (control.type === "toggle") return normToggle(control);
  return pack(control, selectTransport(control).preview, control.defaultValue ?? control.options[0]?.value);
}

function normRange(control: RangeControl): RangeControl {
  const { min, max, step } = control;
  if (!(finite(min) && finite(max) && min < max && Number.isFinite(step) && step >= 0.001 && step <= 10000 && step <= max - min)) {
    fail("OAI-CTRL-005");
  }
  const current = control.currentValue ?? min;
  const fallback = control.defaultValue ?? min;
  if (!(finite(current) && finite(fallback) && current >= min && current <= max && fallback >= min && fallback <= max)) {
    fail("OAI-CTRL-005");
  }
  return pack(control, current, fallback);
}

function normColor(control: ColorControl): ColorControl {
  const current = control.currentValue ?? "#ffffff";
  const fallback = control.defaultValue ?? "#ffffff";
  if (!HEX_COLOR.test(current) || !HEX_COLOR.test(fallback)) fail("OAI-CTRL-006");
  return pack(control, current, fallback);
}

function normToggle(control: ToggleControl): ToggleControl {
  const current = control.currentValue ?? false;
  const fallback = control.defaultValue ?? false;
  if (typeof current !== "boolean" || typeof fallback !== "boolean") fail("OAI-CTRL-006");
  return pack(control, current, fallback);
}

function bundle(controls: readonly AnnotationControlDefinition[], heading?: string, mode?: "replace" | "extend"): AnnotationControlDefinition[] {
  if (controls.length > 12) fail("OAI-CTRL-002");
  const seenCallbacks = new Set<string>();
  const normalized = controls.map((control) => {
    const next = norm(control);
    if (seenCallbacks.has(next.callback)) fail("OAI-CTRL-002");
    seenCallbacks.add(next.callback);
    return next;
  });
  if (heading !== undefined) plain(heading);
  if (mode !== undefined && mode !== "replace" && mode !== "extend") fail("OAI-CTRL-002");
  if (JSON.stringify({ controls, controlsHeading: heading, controlsMode: mode }).length > 16384) fail("OAI-CTRL-002");
  return normalized;
}

function targetsOk(targets: readonly Element[], emptyOk: boolean): void {
  if (targets.length === 0 && emptyOk) return;
  if (targets.length < 1 || targets.length > 128) fail("OAI-CTRL-001");
  const page = doc();
  for (const target of targets) {
    if (!target.isConnected || target.ownerDocument !== page) fail("OAI-CTRL-001");
  }
}

function commit(slot: ControlsSnapshot, source: ControlsSnapshot, fresh: boolean): void {
  targetsOk(source.targets, !fresh);
  const controls = bundle(source.controls, source.controlsHeading, source.controlsMode);
  const previous = fresh ? 0 : slot.targets.length;
  if ((fresh && regs.length >= 64) || links - previous + source.targets.length > 1024) fail("OAI-CTRL-001");
  slot.targets = source.targets;
  slot.controls = controls;
  slot.controlsHeading = source.controlsHeading;
  slot.controlsMode = source.controlsMode;
  links += source.targets.length - previous;
  if (fresh) regs.push(slot);
}

export function resetCoreState(): void {
  regs.length = 0;
  links = 0;
  active = false;
  pending = false;
  space = false;
  unbind?.();
  unbind = undefined;
}

export function diagnoseAnnotatable(element: Element): Diagnostic[] {
  if (!element.hasAttribute(ANN)) return [];
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute(BOX) || node.hasAttribute(TEXT)) return [];
  }
  return [issue("OAI-DOM-001", ANN, "warning", "isolated")];
}

export function resolveAnnotationGesture(element: Element): AnnotationGesture | undefined {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const text = node.hasAttribute(TEXT);
    if (text || node.hasAttribute(BOX)) return text ? "text" : "element";
  }
  return undefined;
}

export function validateMetadata(input: unknown): { metadata?: AnnotationMetadata; diagnostics: Diagnostic[] } {
  return consumeMetadata(input);
}

export function consumeMetadata(input: unknown): { metadata?: AnnotationMetadata; diagnostics: Diagnostic[] } {
  const bad = (code: string) => ({ diagnostics: [issue(code, "metadata", "error", "ignored")] });
  if (input === undefined) return { diagnostics: [] };
  if (!input || typeof input !== "object" || Array.isArray(input)) return bad("OAI-META-001");
  const source = input as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length > 6) return bad("OAI-META-001");
  const metadata: AnnotationMetadata = {};
  for (const key of keys) {
    if (key.length > 64 || !METADATA_KEY.test(key)) return bad("OAI-META-002");
    const value = source[key];
    if (typeof value === "string") {
      if (value.length > 256) return bad("OAI-META-002");
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) return bad("OAI-META-001");
    } else if (typeof value !== "boolean" && value !== null) return bad("OAI-META-001");
    metadata[key] = value;
  }
  return utf8Length(JSON.stringify(metadata)) > 2048 ? bad("OAI-META-002") : { metadata, diagnostics: [] };
}

export function metadataIgnoredForTarget(target: Element | Range): boolean {
  if (isRange(target)) return true;
  return shadow(target);
}

export function isAnnotationActive(): boolean {
  return active;
}

const yes = (accepted: boolean): AnnotationAcceptance => ({ accepted });

export function toggleAnnotation(force?: boolean): AnnotationAcceptance {
  try {
    if (!hot()) return yes(false);
    const next = force === undefined ? !active : force;
    if (next === active) return yes(true);
    active = next;
    if (!next) pending = false;
    doc()?.dispatchEvent(new Event("oaiannotationmodechange"));
    return yes(true);
  } catch {
    return yes(false);
  }
}

export function requestAnnotation(target: Element | Range, options?: AnnotationRequestOptions): AnnotationAcceptance {
  try {
    if (!hot() || pending || active || (options?.initialComment?.length ?? 0) > 240) return yes(false);
    if (isRange(target)) {
      const node = target.commonAncestorContainer;
      if (options?.mode === "advanced" || target.collapsed || (shadow(node) && (node.getRootNode() as ShadowRoot).mode === "closed")) {
        return yes(false);
      }
      const text = target.toString();
      if (text.length > 20000 || text.trim().length === 0 || !seen(target.getBoundingClientRect())) return yes(false);
      pending = true;
      return yes(true);
    }
    if (!target.isConnected || !seen(target.getBoundingClientRect())) return yes(false);
    pending = true;
    return yes(true);
  } catch {
    return yes(false);
  }
}

export function bindAnnotationGuards(): () => void {
  unbind?.();
  const page = doc();
  if (!page) return () => undefined;
  const onKey = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.key === " " || key.code === "Space") space = key.type === "keydown";
  };
  const onPointer = (event: Event) => {
    if (active && !space) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  for (const type of ["keydown", "keyup"]) page.addEventListener(type, onKey, true);
  for (const type of ["click", "submit"]) page.addEventListener(type, onPointer, true);
  unbind = () => {
    for (const type of ["keydown", "keyup"]) page.removeEventListener(type, onKey, true);
    for (const type of ["click", "submit"]) page.removeEventListener(type, onPointer, true);
  };
  return unbind;
}

export function readControls(handle: ControlsRegistrationHandle): ControlsSnapshot {
  return reads.get(handle)?.() ?? fail("OAI-CTRL-008");
}

export function registerControls(config: RegisterControlsConfig): ControlsRegistrationHandle {
  const current: ControlsSnapshot = { targets: [], controls: [] };
  commit(current, {
    targets: list(config.targets),
    controls: config.controls,
    controlsHeading: config.controlsHeading,
    controlsMode: config.controlsMode,
  }, true);
  let disposed = false;
  const handle: ControlsRegistrationHandle = {
    update(next: UpdateControlsConfig) {
      if (disposed) fail("OAI-CTRL-008");
      commit(current, {
        targets: next.targets === undefined ? current.targets : list(next.targets),
        controls: next.controls === undefined ? current.controls : next.controls,
        controlsHeading: next.controlsHeading === undefined ? current.controlsHeading : next.controlsHeading,
        controlsMode: next.controlsMode === undefined ? current.controlsMode : next.controlsMode,
      }, false);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      links -= current.targets.length;
      const index = regs.indexOf(current);
      if (index >= 0) regs.splice(index, 1);
    },
  };
  reads.set(handle, () => current);
  return handle;
}

export function registerSurface(config: RegisterSurfaceConfig): SurfaceRegistrationHandle {
  const element = config.element;
  if (framed(element) || !canInjectAnnotationApi()) fail("OAI-ENV-001");
  if (!(element instanceof HTMLElement) || !element.isConnected || element.getRootNode() !== element.ownerDocument) {
    fail("OAI-SURF-001");
  }
  if (typeof config.hitTest !== "function") fail("OAI-SURF-001");
  return { invalidate() {}, dispose() {} };
}
