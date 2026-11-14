import { afterEach, expect, test, vi } from "vitest";
import { createSafeHitTest, resetSurfaceState, runHitTest, surfaceDiagnostics } from "../src/surfaceGuard";

afterEach(() => {
  vi.useRealTimers();
  resetSurfaceState();
  document.body.replaceChildren();
});

function canvasAt() {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 100;
  canvas.getBoundingClientRect = () =>
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
  document.body.appendChild(canvas);
  return canvas;
}

test("OAI-SURF-002 records a deadlock warning and refuses the next hitTest until the first settles", async () => {
  vi.useFakeTimers();
  const signal = new AbortController();
  const first = runHitTest(() => new Promise(() => undefined), {
    clientX: 0,
    clientY: 0,
    signal: signal.signal,
  });
  signal.abort();
  await vi.advanceTimersByTimeAsync(250);
  await expect(first).resolves.toBeNull();
  expect(surfaceDiagnostics()).toContainEqual({
    code: "OAI-SURF-002",
    message: "deadlock",
    field: "hitTest",
    severity: "warning",
  });
  let calls = 0;
  const second = runHitTest(
    () => {
      calls += 1;
      return null;
    },
    { clientX: 1, clientY: 1, signal: new AbortController().signal },
  );
  await expect(second).resolves.toBeNull();
  expect(calls).toBe(0);
});

test("createSafeHitTest converts canvas coordinates and settles null on abort", async () => {
  const canvas = canvasAt();
  let seen = { canvasX: -1, canvasY: -1 };
  const safe = createSafeHitTest(canvas, (args) => {
    seen = { canvasX: args.canvasX, canvasY: args.canvasY };
    return new Promise(() => undefined);
  });
  const signal = new AbortController();
  const pending = safe.hitTest({ clientX: 60, clientY: 45, signal: signal.signal });
  await Promise.resolve();
  expect(seen).toEqual({ canvasX: 100, canvasY: 50 });
  signal.abort();
  await expect(pending).resolves.toBeNull();
  const next = createSafeHitTest(canvas, () => ({ id: "q3" }));
  await expect(next.hitTest({ clientX: 60, clientY: 45, signal: new AbortController().signal })).resolves.toEqual({
    id: "q3",
  });
  expect(safe.toViewportRect({ x: 100, y: 50, width: 20, height: 10 })).toEqual({
    x: 60,
    y: 45,
    width: 10,
    height: 5,
  });
});
