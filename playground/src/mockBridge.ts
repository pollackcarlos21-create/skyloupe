export interface MockChange {
  reference?: string;
  requestedValue: string | number | boolean;
}

export interface MockBundle {
  controlChanges?: MockChange[];
  comment?: string;
}

export function applyAnnotation(root: HTMLElement, bundle: MockBundle): void {
  for (const change of bundle.controlChanges ?? []) {
    if (!change.reference) continue;
    const value = typeof change.requestedValue === "number" ? `${change.requestedValue}px` : String(change.requestedValue);
    root.style.setProperty(change.reference, value);
  }
  root.dataset.applied = "true";
}

export function installMockBridge(apply: (bundle: MockBundle) => void): void {
  const session = { port: 4777, token: "playground" };
  (globalThis as { __SKYLOUPE_SESSION__?: typeof session }).__SKYLOUPE_SESSION__ = session;
  const previous = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("127.0.0.1:4777")) return previous(input, init);
    if (url.endsWith("/health")) return Response.json({ ok: true });
    if (url.endsWith("/annotations") && init?.method === "POST") {
      const bundle = JSON.parse(String(init.body ?? "{}")) as MockBundle;
      apply(bundle);
      return new Response(JSON.stringify({ id: "playground" }), { status: 202, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/events")) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"turn","status":"completed"}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"type":"reset","id":"playground"}\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    }
    return new Response("Not Found", { status: 404 });
  };
}
