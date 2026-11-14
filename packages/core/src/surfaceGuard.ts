import type { Diagnostic } from "./validators";
import type { SurfaceHitTestArgs, SurfaceHitTestResult, SurfaceRect } from "./types";

export interface SafeHitTestArgs extends SurfaceHitTestArgs {
  canvasX: number;
  canvasY: number;
}

export type CanvasRef = HTMLCanvasElement | { current: HTMLCanvasElement | null };

export interface SafeHitTest {
  hitTest(args: SurfaceHitTestArgs): Promise<SurfaceHitTestResult | null>;
  toViewportRect(canvasRect: SurfaceRect): SurfaceRect;
}

const warnings: Diagnostic[] = [];
let inflight: Promise<SurfaceHitTestResult | null> | null = null;

export function surfaceDiagnostics(): readonly Diagnostic[] {
  return warnings;
}

export function resetSurfaceState(): void {
  inflight = null;
  warnings.length = 0;
}

function canvasFrom(ref: CanvasRef): HTMLCanvasElement | null {
  return ref instanceof HTMLCanvasElement ? ref : ref.current;
}

function metrics(ref: CanvasRef) {
  const canvas = canvasFrom(ref);
  const box = canvas?.getBoundingClientRect();
  if (!canvas || !box || !canvas.width || !canvas.height || !box.width || !box.height) return;
  return {
    box,
    toCanvasX: canvas.width / box.width,
    toCanvasY: canvas.height / box.height,
    toViewX: box.width / canvas.width,
    toViewY: box.height / canvas.height,
  };
}

export function runHitTest(
  hitTest: (args: SurfaceHitTestArgs) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>,
  args: SurfaceHitTestArgs,
): Promise<SurfaceHitTestResult | null> {
  if (inflight) return Promise.resolve(null);
  const clear = () => {
    if (inflight === tracked) inflight = null;
  };
  const tracked: Promise<SurfaceHitTestResult | null> = Promise.resolve()
    .then(() => hitTest(args))
    .then(
      (value) => (clear(), value),
      () => (clear(), null),
    );
  inflight = tracked;
  return Promise.race([
    tracked,
    new Promise<null>((resolve) => {
      const timer = setTimeout(() => {
        if (inflight === tracked) {
          warnings.push({ code: "OAI-SURF-002", message: "deadlock", field: "hitTest", severity: "warning" });
        }
        resolve(null);
      }, 250);
      tracked.finally(() => clearTimeout(timer));
    }),
  ]);
}

export function createSafeHitTest(
  canvasRef: CanvasRef,
  userHitTest: (args: SafeHitTestArgs) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>,
): SafeHitTest {
  return {
    toViewportRect(rect) {
      const scale = metrics(canvasRef);
      if (!scale) return { ...rect };
      return {
        x: scale.box.left + rect.x * scale.toViewX,
        y: scale.box.top + rect.y * scale.toViewY,
        width: rect.width * scale.toViewX,
        height: rect.height * scale.toViewY,
      };
    },
    hitTest: (args) =>
      runHitTest((official) => {
        const scale = metrics(canvasRef);
        const canvasX = scale ? (official.clientX - scale.box.left) * scale.toCanvasX : official.clientX;
        const canvasY = scale ? (official.clientY - scale.box.top) * scale.toCanvasY : official.clientY;
        if (official.signal.aborted) return null;
        return new Promise<SurfaceHitTestResult | null>((resolve) => {
          let done = false;
          const finish = (value: SurfaceHitTestResult | null) => {
            if (!done) {
              done = true;
              resolve(value);
            }
          };
          official.signal.addEventListener("abort", () => finish(null), { once: true });
          Promise.resolve(userHitTest({ ...official, canvasX, canvasY })).then(
            (value) => {
              if (!official.signal.aborted) finish(value);
            },
            () => finish(null),
          );
        });
      }, args),
  };
}
