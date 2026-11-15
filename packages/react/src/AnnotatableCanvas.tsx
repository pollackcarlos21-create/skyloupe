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

const CANVAS_LOCATE = Symbol.for("skyloupe.locateCanvasTarget");

interface TargetSlot {
  current: Record<string, string | number | boolean>;
  original: Record<string, string | number | boolean>;
  displayed: Record<string, string | number | boolean>;
}

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
  const objectsRef = useRef(virtualObjects);
  const hitTestRef = useRef(hitTest);
  const renderSelectionRef = useRef(renderSelection);
  const onControlChangeRef = useRef(onControlChange);
  const controlsRef = useRef(controls);
  const headingRef = useRef(controlsHeading);
  const modeRef = useRef(controlsMode);
  objectsRef.current = virtualObjects;
  hitTestRef.current = hitTest;
  renderSelectionRef.current = renderSelection;
  onControlChangeRef.current = onControlChange;
  controlsRef.current = controls;
  headingRef.current = controlsHeading;
  modeRef.current = controlsMode;
  const surfaceRef = useRef<SurfaceRegistrationHandle | undefined>(undefined);
  const registrationRef = useRef<ControlsRegistrationHandle | undefined>(undefined);
  const targets = useRef(new Map<string, TargetSlot>());
  const selectedRef = useRef<string | null>(null);
  const publishRef = useRef<(id: string | null) => void>(() => undefined);
  const controlsStamp = `${JSON.stringify(controls.map(toOfficialControl))}\n${controlsHeading ?? ""}\n${controlsMode ?? ""}`;

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const view = { map: (rect: SurfaceRect) => rect };
    const safe = createSafeHitTest(ref, (args) => {
      const custom = hitTestRef.current;
      if (custom) {
        return Promise.resolve(custom(args)).then((value) =>
          value?.rect ? { ...value, rect: view.map(value.rect) } : value,
        );
      }
      const found = objectsRef.current.find((object) => contains(args.canvasX, args.canvasY, object.rect));
      if (!found) return null;
      return {
        id: found.id,
        name: found.name,
        role: found.role,
        metadata: found.metadata,
        rect: view.map(found.rect),
      };
    });
    view.map = (rect) => safe.toViewportRect(rect);

    let listening = false;
    const syncTargets = () => {
      for (const object of objectsRef.current) {
        const existing = targets.current.get(object.id);
        if (!existing) {
          const seeded = seedTarget(object, controlsRef.current);
          targets.current.set(object.id, { current: seeded, original: { ...seeded }, displayed: { ...seeded } });
          continue;
        }
        for (const control of controlsRef.current) {
          if (control.callback in existing.current) continue;
          const own = object.controlState?.[control.callback];
          const value = own !== undefined ? own : fallbackValue(control);
          existing.current[control.callback] = value;
          existing.original[control.callback] = value;
          existing.displayed[control.callback] = value;
        }
      }
    };
    const officialFor = (id: string | null) => {
      syncTargets();
      const slot = id ? targets.current.get(id) : undefined;
      return controlsRef.current.map((control) => {
        const current = slot?.current[control.callback] ?? fallbackValue(control);
        const original = slot?.original[control.callback] ?? current;
        return toOfficialControl({ ...control, currentValue: current, defaultValue: original } as PreviewControl);
      });
    };
    const publish = (id: string | null) => {
      const canvas = ref.current;
      const api = document.oai?.annotation;
      if (!canvas || !api) return;
      const official = officialFor(id);
      if (!registrationRef.current) {
        if (official.length === 0) return;
        registrationRef.current = api.registerControls({
          targets: [canvas],
          controls: official,
          controlsHeading: headingRef.current,
          controlsMode: modeRef.current,
        });
        return;
      }
      registrationRef.current.update({
        controls: official,
        controlsHeading: headingRef.current,
        controlsMode: modeRef.current,
      });
    };
    publishRef.current = publish;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<AnnotationControlChangeDetail>).detail;
      const targetId = detail.virtualTarget?.targetId;
      syncTargets();
      const slot = targetId ? targets.current.get(targetId) : undefined;
      let next = detail;
      if (slot) {
        if (detail.action === "preview") {
          slot.current[detail.callback] = detail.value;
          slot.displayed[detail.callback] = detail.value;
        } else {
          const original = slot.original[detail.callback];
          if (original !== undefined) next = { ...detail, value: original };
          slot.displayed[detail.callback] = next.value;
          if (detail.action === "reset") slot.current[detail.callback] = next.value;
        }
      }
      onControlChangeRef.current?.(
        next,
        objectsRef.current.find((object) => object.id === targetId),
      );
    };
    const locate = (id: string) => {
      const canvas = ref.current;
      const object = objectsRef.current.find((item) => item.id === id);
      if (!canvas || !object) return null;
      syncTargets();
      const box = canvas.getBoundingClientRect();
      const scaleX = canvas.width ? box.width / canvas.width : 1;
      const scaleY = canvas.height ? box.height / canvas.height : 1;
      const slot = targets.current.get(id);
      const radiusControl = controlsRef.current.find(
        (control) => control.type === "range" && /radius/i.test(`${control.callback} ${control.label}`),
      );
      const fromSlot = radiusControl ? slot?.displayed[radiusControl.callback] : undefined;
      const radius = typeof fromSlot === "number" ? fromSlot : (object.radius ?? 0);
      return {
        rect: {
          x: box.left + object.rect.x * scaleX,
          y: box.top + object.rect.y * scaleY,
          width: object.rect.width * scaleX,
          height: object.rect.height * scaleY,
        },
        radius: radius * scaleX,
      };
    };
    const sync = () => {
      const canvas = ref.current;
      const api = document.oai?.annotation;
      if (!canvas || !api || surfaceRef.current) return;
      (canvas as HTMLCanvasElement & { [CANVAS_LOCATE]?: typeof locate })[CANVAS_LOCATE] = locate;
      surfaceRef.current = api.registerSurface({
        element: canvas,
        hitTest: (args) => safe.hitTest(args),
        renderSelection: (args) => {
          selectedRef.current = args.selectedId;
          publish(args.selectedId);
          renderSelectionRef.current?.(args);
        },
      });
      publish(selectedRef.current);
      canvas.addEventListener("oaiannotationcontrolchange", onChange);
      listening = true;
    };
    const onReady = () => sync();
    document.addEventListener("skyloupe:polyfill-ready", onReady);
    sync();
    return () => {
      document.removeEventListener("skyloupe:polyfill-ready", onReady);
      const canvas = ref.current;
      if (canvas && listening) canvas.removeEventListener("oaiannotationcontrolchange", onChange);
      if (canvas) delete (canvas as HTMLCanvasElement & { [CANVAS_LOCATE]?: unknown })[CANVAS_LOCATE];
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
  }, [controlsStamp, controlsHeading, controlsMode]);

  useLayoutEffect(() => {
    surfaceRef.current?.invalidate();
  });

  return <canvas ref={ref} {...rest} />;
}

function contains(x: number, y: number, rect: SurfaceRect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function fallbackValue(control: PreviewControl): string | number | boolean {
  if (control.currentValue !== undefined) return control.currentValue;
  if (control.type === "range") return control.min;
  if (control.type === "color") return "#ffffff";
  if (control.type === "toggle") return false;
  return control.options[0]?.value ?? "";
}

function seedTarget(object: VirtualObject, controls: readonly PreviewControl[]): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  for (const control of controls) {
    const own = object.controlState?.[control.callback];
    values[control.callback] = own !== undefined ? own : fallbackValue(control);
  }
  return values;
}
