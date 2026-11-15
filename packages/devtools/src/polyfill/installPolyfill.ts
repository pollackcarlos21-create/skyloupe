import { canInjectAnnotationApi } from "@skyloupe/core";
import {
  bindAnnotationGuards,
  isAnnotationActive,
  requestAnnotation,
  resetCoreState,
  toggleAnnotation,
} from "@skyloupe/core/validators";
import type { OaiAnnotationNamespace } from "@skyloupe/core";
import { mountOverlay } from "../overlay/shadowHost";
import { clearRegistry, trackedRegisterControls, trackedRegisterSurface } from "./registry";

export type DevtoolsMode = "polyfill-standalone" | "native-companion" | "native-passthrough";

let wired = false;

export function resetDevtools(): void {
  wired = false;
  clearRegistry();
  document.querySelector("skyloupe-devtools-host")?.remove();
  document.oai = undefined;
  resetCoreState();
}

export function installPolyfill(options?: { inspector?: boolean }): DevtoolsMode {
  if (typeof document === "undefined") return "native-passthrough";
  if (wired && document.oai?.annotation) return "polyfill-standalone";
  const native = document.oai?.annotation;
  if (native) return options?.inspector === false ? "native-passthrough" : "native-companion";
  if (!canInjectAnnotationApi()) return "native-passthrough";
  if (wired) return "polyfill-standalone";
  const annotation: OaiAnnotationNamespace = {
    isActive: isAnnotationActive,
    toggle: toggleAnnotation,
    request: requestAnnotation,
    registerControls: trackedRegisterControls,
    registerSurface: trackedRegisterSurface,
  };
  document.oai = { ...document.oai, annotation };
  bindAnnotationGuards();
  wired = true;
  document.dispatchEvent(new CustomEvent("skyloupe:polyfill-ready"));
  return "polyfill-standalone";
}

export function mountDevtools(options?: { inspector?: boolean }): DevtoolsMode {
  const mode = installPolyfill(options);
  if (mode === "native-passthrough" || typeof document === "undefined") return mode;
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", () => mountOverlay(mode), { once: true });
    return mode;
  }
  mountOverlay(mode);
  return mode;
}
