export interface BridgeLamp {
  connected: boolean;
  label: "Codex Connected" | "Clipboard Mode" | "Native browser";
}

export function bridgeLamp(mode: "polyfill-standalone" | "native-companion"): BridgeLamp {
  if (mode === "native-companion") return { connected: false, label: "Native browser" };
  return { connected: false, label: "Clipboard Mode" };
}
