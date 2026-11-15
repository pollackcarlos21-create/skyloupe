export interface SkyLoupeSession {
  port: number;
  token: string;
}

export interface BridgeLamp {
  connected: boolean;
  label: "Codex Connected" | "Clipboard Mode" | "Native browser";
}

export interface BridgeEvent {
  type: "turn" | "reset" | "queued" | "progress";
  status?: string;
  id?: string;
  files?: string[];
  message?: string;
}

export function readBrowserSession(): SkyLoupeSession | null {
  const value = (globalThis as { __SKYLOUPE_SESSION__?: SkyLoupeSession | null }).__SKYLOUPE_SESSION__;
  if (!value || typeof value.port !== "number" || typeof value.token !== "string" || value.token.length === 0) return null;
  return value;
}

export function bridgeLamp(mode: "polyfill-standalone" | "native-companion", connected = false): BridgeLamp {
  if (mode === "native-companion") return { connected: false, label: "Native browser" };
  return connected ? { connected: true, label: "Codex Connected" } : { connected: false, label: "Clipboard Mode" };
}

export async function probeBridge(session: SkyLoupeSession): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${session.port}/health`, {
      headers: { "X-SkyLoupe-Token": session.token },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendAnnotation(session: SkyLoupeSession, body: unknown): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${session.port}/annotations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-SkyLoupe-Token": session.token,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`bridge ${response.status}`);
}

export async function listenBridge(session: SkyLoupeSession, onEvent: (event: BridgeEvent) => void): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${session.port}/events`, {
    headers: { "X-SkyLoupe-Token": session.token },
  });
  if (!response.ok || !response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return;
    buffer += decoder.decode(chunk.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
      if (!data) continue;
      onEvent(JSON.parse(data) as BridgeEvent);
    }
  }
}
