import { HIT_TEST_MS } from "./constants";
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
let inflight: Promise<unknown> | null = null;

export function surfaceDiagnostics(): readonly Diagnostic[] {
  return warnings;
}

export function resetSurfaceState(): void {
  inflight = null;
  warnings.length = 0;
}

function canvasFrom(ref: CanvasRef): HTMLCanvasElement | null {
  if (typeof HTMLCanvasElement === "function" && ref instanceof HTMLCanvasElement) return ref;
  if ("current" in ref) return ref.current;
  return null;
}

function boxOf(canvas: HTMLCanvasElement | null): DOMRect | null {
  return canvas ? canvas.getBoundingClientRect() : null;
}

export function runHitTest(
  hitTest: (
    args: SurfaceHitTestArgs,
  ) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>,
  args: SurfaceHitTestArgs,
): Promise<SurfaceHitTestResult | null> {
  if (inflight) return Promise.resolve(null);
  const tracked = Promise.resolve()
    .then(() => hitTest(args))
    .then(
      (value) => {
        if (inflight === tracked) inflight = null;
        return value;
      },
      () => {
        if (inflight === tracked) inflight = null;
        return null;
      },
    );
  inflight = tracked;
  const timed = new Promise<null>((resolve) => {
    const timer = setTimeout(() => {
      if (inflight === tracked) {
        warnings.push({
          code: "OAI-SURF-002",
          message: "deadlock",
          field: "hitTest",
          severity: "warning",
        });
      }
      resolve(null);
    }, HIT_TEST_MS);
    tracked.then(
      () => clearTimeout(timer),
      () => clearTimeout(timer),
    );
  });
  return Promise.race([tracked, timed]);
}

export function createSafeHitTest(
  canvasRef: CanvasRef,
  userHitTest: (
    args: SafeHitTestArgs,
  ) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>,
): SafeHitTest {
  const toViewportRect = (canvasRect: SurfaceRect): SurfaceRect => {
    const canvas = canvasFrom(canvasRef);
    const box = boxOf(canvas);
    if (!canvas || !box || canvas.width === 0 || canvas.height === 0) return { ...canvasRect };
    const scaleX = box.width / canvas.width;
    const scaleY = box.height / canvas.height;
    return {
      x: box.left + canvasRect.x * scaleX,
      y: box.top + canvasRect.y * scaleY,
      width: canvasRect.width * scaleX,
      height: canvasRect.height * scaleY,
    };
  };

  const hitTest = (args: SurfaceHitTestArgs) =>
    runHitTest((official) => {
      const canvas = canvasFrom(canvasRef);
      const box = boxOf(canvas);
      const scaleX = canvas && box && box.width !== 0 ? canvas.width / box.width : 1;
      const scaleY = canvas && box && box.height !== 0 ? canvas.height / box.height : 1;
      const canvasX = box ? (official.clientX - box.left) * scaleX : official.clientX;
      const canvasY = box ? (official.clientY - box.top) * scaleY : official.clientY;
      if (official.signal.aborted) return null;
      return new Promise<SurfaceHitTestResult | null>((resolve) => {
        let settled = false;
        const finish = (value: SurfaceHitTestResult | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        official.signal.addEventListener("abort", () => finish(null), { once: true });
        Promise.resolve(userHitTest({ ...official, canvasX, canvasY })).then(
          (value) => {
            if (!official.signal.aborted) finish(value);
          },
          () => finish(null),
        );
      });
    }, args);

  return { hitTest, toViewportRect };
}
