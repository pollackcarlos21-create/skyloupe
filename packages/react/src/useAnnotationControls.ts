import {
  createPreviewManager,
  type AnnotationControlChangeDetail,
  type ControlsRegistrationHandle,
  type PreviewManager,
} from "@skyloupe/core";
import { useLayoutEffect, useRef } from "react";
import { toOfficialControl, toPreviewBinding, type PreviewControl } from "./official";

export interface ElementRef {
  readonly current: Element | null;
}

export interface AnnotationControlsConfig {
  controlsHeading?: string;
  controlsMode?: "replace" | "extend";
  controls: PreviewControl[];
}

interface Runtime {
  preview: PreviewManager;
  registration?: ControlsRegistrationHandle;
  bound: Element[];
}

function elementsOf(target: ElementRef | readonly ElementRef[]): Element[] {
  const refs = Array.isArray(target) ? target : [target];
  const found: Element[] = [];
  for (const ref of refs) {
    if (ref.current) found.push(ref.current);
  }
  return found;
}

function sameElements(left: readonly Element[], right: readonly Element[]): boolean {
  return left.length === right.length && left.every((element, index) => element === right[index]);
}

export function useAnnotationControls(
  target: ElementRef | readonly ElementRef[],
  config: AnnotationControlsConfig,
): void {
  const targetRef = useRef(target);
  const configRef = useRef(config);
  targetRef.current = target;
  configRef.current = config;
  const signature = JSON.stringify(config.controls.map((control) => control.currentValue));
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const registeredSignature = useRef<string | null>(null);
  const runtime = useRef<Runtime | null>(null);
  const syncRef = useRef<() => void>(() => undefined);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const preview = createPreviewManager();
    const state: Runtime = { preview, bound: [] };
    runtime.current = state;

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<AnnotationControlChangeDetail>).detail;
      const element = event.currentTarget;
      const binding = configRef.current.controls.find((control) => control.callback === detail.callback);
      if (!(element instanceof Element) || !binding) return;
      preview.apply(detail, element, toPreviewBinding(binding));
    };

    const sync = () => {
      if (typeof document === "undefined") return;
      const api = document.oai?.annotation;
      const next = elementsOf(targetRef.current);
      if (!api || next.length === 0) return;
      const official = configRef.current.controls.map(toOfficialControl);
      if (!state.registration) {
        state.registration = api.registerControls({
          targets: next,
          controls: official,
          controlsHeading: configRef.current.controlsHeading,
          controlsMode: configRef.current.controlsMode,
        });
        registeredSignature.current = signatureRef.current;
      } else if (!sameElements(state.bound, next)) {
        state.registration.update({ targets: next });
      }
      for (const element of state.bound) {
        if (!next.includes(element)) {
          preview.dispose(element);
          element.removeEventListener("oaiannotationcontrolchange", onChange);
        }
      }
      for (const element of next) {
        if (!state.bound.includes(element)) element.addEventListener("oaiannotationcontrolchange", onChange);
      }
      state.bound = next;
    };

    syncRef.current = sync;
    const onReady = () => sync();
    document.addEventListener("skyloupe:polyfill-ready", onReady);
    sync();

    return () => {
      document.removeEventListener("skyloupe:polyfill-ready", onReady);
      for (const element of state.bound) preview.dispose(element);
      for (const element of state.bound) element.removeEventListener("oaiannotationcontrolchange", onChange);
      state.registration?.dispose();
      runtime.current = null;
      syncRef.current = () => undefined;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    syncRef.current();
  });

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const registration = runtime.current?.registration;
    if (!registration || registeredSignature.current === signature) return;
    registeredSignature.current = signature;
    registration.update({ controls: configRef.current.controls.map(toOfficialControl) });
  }, [signature]);
}
