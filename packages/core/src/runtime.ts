import type { OaiAnnotationNamespace } from "./types";

type HostWindow = {
  location?: { protocol: string; hostname: string };
  top: HostWindow | null;
};

function readHost(): HostWindow | undefined {
  const root = globalThis as unknown as Record<string, unknown>;
  return root["window"] as HostWindow | undefined;
}

export function isSecureTopLocation(protocol: string, hostname: string, isTop: boolean): boolean {
  if (!isTop) return false;
  if (protocol === "https:") return true;
  return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
}

export function canInjectAnnotationApi(): boolean {
  const host = readHost();
  const location = host?.location;
  if (!host || !location) return false;
  return isSecureTopLocation(location.protocol, location.hostname, host === host.top);
}

export function nativeAnnotation(): OaiAnnotationNamespace | undefined {
  const root = globalThis as unknown as Record<string, unknown>;
  const doc = root["document"] as { oai?: { annotation?: OaiAnnotationNamespace } } | undefined;
  return doc?.oai?.annotation;
}
