import type { OaiAnnotationNamespace } from "./types";

type Host = typeof globalThis & {
  location?: { protocol: string; hostname: string };
  top?: typeof globalThis;
  document?: { oai?: { annotation?: OaiAnnotationNamespace } };
};

const host = (): Host => globalThis as Host;

export function isSecureTopLocation(protocol: string, hostname: string, isTop: boolean): boolean {
  return isTop && (protocol === "https:" || (protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1")));
}

export function canInjectAnnotationApi(): boolean {
  const loc = host().location;
  const current = host();
  return !!loc && isSecureTopLocation(loc.protocol, loc.hostname, (current.top as object | undefined) === current);
}

export function nativeAnnotation(): OaiAnnotationNamespace | undefined {
  return host().document?.oai?.annotation;
}
