import {
  createSafeHitTest,
  type AnnotationControlChangeDetail,
  type AnnotationMetadata,
  type ControlsRegistrationHandle,
  type SurfaceHitTestResult,
  type SurfaceRect,
  type SurfaceRegistrationHandle,
} from "@skyloupe/core";
import { useLayoutEffect, useRef, type CanvasHTMLAttributes, type ReactElement } from "react";
import { toOfficialControl, type PreviewControl } from "./official";

export interface VirtualObject {
  id: string;
  name?: string;
  role?: string;
  metadata?: AnnotationMetadata;
  rect: SurfaceRect;
  radius?: number;
  controlState?: Readonly<Record<string, string | number | boolean>>;
}

const LOCATE = Symbol.for("skyloupe.locateCanvasTarget");
type Value = string | number | boolean;
type Slot = { current: Record<string, Value>; original: Record<string, Value>; displayed: Record<string, Value> };

type HitTestFn = (args: {
  clientX: number;
  clientY: number;
  canvasX: number;
  canvasY: number;
  signal: AbortSignal;
}) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>;

export function AnnotatableCanvas({
  virtualObjects = [],
  hitTest,
  renderSelection,
  controls = [],
  controlsHeading,
  controlsMode,
  onControlChange,
  ...rest
}: CanvasHTMLAttributes<HTMLCanvasElement> & {
  virtualObjects?: readonly VirtualObject[];
  hitTest?: HitTestFn;
  renderSelection?: (args: { hoveredId: string | null; selectedId: string | null }) => void;
  controls?: PreviewControl[];
  controlsHeading?: string;
  controlsMode?: "replace" | "extend";
  onControlChange?: (detail: AnnotationControlChangeDetail, object: VirtualObject | undefined) => void;
}): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const bag = useRef({ virtualObjects, hitTest, renderSelection, controls, controlsHeading, controlsMode, onControlChange });
  bag.current = { virtualObjects, hitTest, renderSelection, controls, controlsHeading, controlsMode, onControlChange };
  const surfaceRef = useRef<SurfaceRegistrationHandle | undefined>(undefined);
  const registrationRef = useRef<ControlsRegistrationHandle | undefined>(undefined);
  const targets = useRef(new Map<string, Slot>());
  const selectedRef = useRef<string | null>(null);
  const publishRef = useRef<(id: string | null) => void>(() => undefined);
  const stamp = `${controlsHeading ?? ""}\n${controlsMode ?? ""}\n${controls.map((control) => control.callback).join(",")}`;

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const view = { map: (rect: SurfaceRect) => rect };
    const safe = createSafeHitTest(ref, (args) => {
      const custom = bag.current.hitTest;
      if (custom) {
        return Promise.resolve(custom(args)).then((value) => (value?.rect ? { ...value, rect: view.map(value.rect) } : value));
      }
      const found = bag.current.virtualObjects.find((object) => contains(args.canvasX, args.canvasY, object.rect));
      return found
        ? { id: found.id, name: found.name, role: found.role, metadata: found.metadata, rect: view.map(found.rect) }
        : null;
    });
    view.map = (rect) => safe.toViewportRect(rect);
    let listening = false;
    const syncTargets = () => {
      for (const object of bag.current.virtualObjects) {
        const slot = targets.current.get(object.id);
        if (!slot) {
          const seeded = seed(object, bag.current.controls);
          targets.current.set(object.id, { current: seeded, original: { ...seeded }, displayed: { ...seeded } });
          continue;
        }
        for (const control of bag.current.controls) {
          if (control.callback in slot.current) continue;
          const value = object.controlState?.[control.callback] ?? fallback(control);
          slot.current[control.callback] = value;
          slot.original[control.callback] = value;
          slot.displayed[control.callback] = value;
        }
      }
    };
    const officialFor = (id: string | null) => {
      syncTargets();
      const slot = id ? targets.current.get(id) : undefined;
      return bag.current.controls.map((control) => {
        const current = slot?.current[control.callback] ?? fallback(control);
        const original = slot?.original[control.callback] ?? current;
        return toOfficialControl({ ...control, currentValue: current, defaultValue: original } as PreviewControl);
      });
    };
    const publish = (id: string | null) => {
      const canvas = ref.current;
      const api = document.oai?.annotation;
      if (!canvas || !api) return;
      const official = officialFor(id);
      const heading = bag.current.controlsHeading;
      const mode = bag.current.controlsMode;
      if (!registrationRef.current) {
        if (!official.length) return;
        registrationRef.current = api.registerControls({ targets: [canvas], controls: official, controlsHeading: heading, controlsMode: mode });
        return;
      }
      registrationRef.current.update({ controls: official, controlsHeading: heading, controlsMode: mode });
    };
    publishRef.current = publish;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<AnnotationControlChangeDetail>).detail;
      const targetId = detail.virtualTarget?.targetId;
      syncTargets();
      const slot = targetId ? targets.current.get(targetId) : undefined;
      let next = detail;
      if (slot) {
        if (detail.action === "preview") slot.current[detail.callback] = slot.displayed[detail.callback] = detail.value;
        else {
          const original = slot.original[detail.callback];
          if (original !== undefined) next = { ...detail, value: original };
          slot.displayed[detail.callback] = next.value;
          if (detail.action === "reset") slot.current[detail.callback] = next.value;
        }
      }
      bag.current.onControlChange?.(next, bag.current.virtualObjects.find((object) => object.id === targetId));
    };
    const locate = (id: string) => {
      const canvas = ref.current;
      const object = bag.current.virtualObjects.find((item) => item.id === id);
      if (!canvas || !object) return null;
      syncTargets();
      const box = canvas.getBoundingClientRect();
      const scaleX = canvas.width ? box.width / canvas.width : 1;
      const scaleY = canvas.height ? box.height / canvas.height : 1;
      const slot = targets.current.get(id);
      const radiusControl = bag.current.controls.find((control) => control.type === "range" && /radius/i.test(`${control.callback} ${control.label}`));
      const fromSlot = radiusControl ? slot?.displayed[radiusControl.callback] : undefined;
      const radius = (typeof fromSlot === "number" ? fromSlot : (object.radius ?? 0)) * scaleX;
      return {
        rect: { x: box.left + object.rect.x * scaleX, y: box.top + object.rect.y * scaleY, width: object.rect.width * scaleX, height: object.rect.height * scaleY },
        radius,
      };
    };
    const sync = () => {
      const canvas = ref.current;
      const api = document.oai?.annotation;
      if (!canvas || !api || surfaceRef.current) return;
      (canvas as HTMLCanvasElement & { [LOCATE]?: typeof locate })[LOCATE] = locate;
      surfaceRef.current = api.registerSurface({
        element: canvas,
        hitTest: (args) => safe.hitTest(args),
        renderSelection: (args) => {
          selectedRef.current = args.selectedId;
          publish(args.selectedId);
          bag.current.renderSelection?.(args);
        },
      });
      publish(selectedRef.current);
      canvas.addEventListener("oaiannotationcontrolchange", onChange);
      listening = true;
    };
    document.addEventListener("skyloupe:polyfill-ready", sync);
    sync();
    return () => {
      document.removeEventListener("skyloupe:polyfill-ready", sync);
      const canvas = ref.current;
      if (canvas && listening) canvas.removeEventListener("oaiannotationcontrolchange", onChange);
      if (canvas) delete (canvas as HTMLCanvasElement & { [LOCATE]?: unknown })[LOCATE];
      publishRef.current = () => undefined;
      registrationRef.current?.dispose();
      registrationRef.current = undefined;
      surfaceRef.current?.dispose();
      surfaceRef.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined" || !surfaceRef.current) return;
    publishRef.current(selectedRef.current);
  }, [stamp]);

  useLayoutEffect(() => {
    surfaceRef.current?.invalidate();
  });

  return <canvas ref={ref} {...rest} />;
}

function contains(x: number, y: number, rect: SurfaceRect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function fallback(control: PreviewControl): Value {
  if (control.currentValue !== undefined) return control.currentValue;
  if (control.type === "range") return control.min;
  if (control.type === "color") return "#ffffff";
  if (control.type === "toggle") return false;
  return control.options[0]?.value ?? "";
}

function seed(object: VirtualObject, controls: readonly PreviewControl[]): Record<string, Value> {
  const values: Record<string, Value> = {};
  for (const control of controls) values[control.callback] = object.controlState?.[control.callback] ?? fallback(control);
  return values;
}
