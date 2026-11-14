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
  const controlsStamp = `${JSON.stringify(controls.map(toOfficialControl))}\n${controlsHeading ?? ""}\n${controlsMode ?? ""}`;
  const controlsStampRef = useRef(controlsStamp);
  const appliedStamp = useRef<string | null>(null);
  controlsStampRef.current = controlsStamp;

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
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<AnnotationControlChangeDetail>).detail;
      const targetId = detail.virtualTarget?.targetId;
      onControlChangeRef.current?.(
        detail,
        objectsRef.current.find((object) => object.id === targetId),
      );
    };
    const sync = () => {
      const canvas = ref.current;
      const api = document.oai?.annotation;
      if (!canvas || !api || surfaceRef.current) return;
      surfaceRef.current = api.registerSurface({
        element: canvas,
        hitTest: (args) => safe.hitTest(args),
        renderSelection: (args) => renderSelectionRef.current?.(args),
      });
      const official = controlsRef.current.map(toOfficialControl);
      if (official.length > 0) {
        registrationRef.current = api.registerControls({
          targets: [canvas],
          controls: official,
          controlsHeading: headingRef.current,
          controlsMode: modeRef.current,
        });
      }
      appliedStamp.current = controlsStampRef.current;
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
      registrationRef.current?.dispose();
      registrationRef.current = undefined;
      surfaceRef.current?.dispose();
      surfaceRef.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const canvas = ref.current;
    const api = document.oai?.annotation;
    if (!canvas || !api || !surfaceRef.current || appliedStamp.current === controlsStamp) return;
    const official = controlsRef.current.map(toOfficialControl);
    if (!registrationRef.current) {
      if (official.length === 0) {
        appliedStamp.current = controlsStamp;
        return;
      }
      registrationRef.current = api.registerControls({
        targets: [canvas],
        controls: official,
        controlsHeading,
        controlsMode,
      });
    } else {
      registrationRef.current.update({ controls: official, controlsHeading, controlsMode });
    }
    appliedStamp.current = controlsStamp;
  }, [controlsStamp, controlsHeading, controlsMode]);

  useLayoutEffect(() => {
    surfaceRef.current?.invalidate();
  });

  return <canvas ref={ref} {...rest} />;
}

function contains(x: number, y: number, rect: SurfaceRect): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}
