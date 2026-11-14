import {
  readControls,
  registerControls as registerControlsRules,
  registerSurface as registerSurfaceRules,
} from "@skyloupe/core/validators";
import type {
  AnnotationControlDefinition,
  ControlsRegistrationHandle,
  RegisterControlsConfig,
  RegisterSurfaceConfig,
  SurfaceRegistrationHandle,
} from "@skyloupe/core";

export interface SurfaceEntry {
  element: HTMLElement;
  hitTest: RegisterSurfaceConfig["hitTest"];
  renderSelection?: RegisterSurfaceConfig["renderSelection"];
  alive: boolean;
}

export interface RegistrationEntry {
  targets(): readonly Element[];
  controls(): readonly AnnotationControlDefinition[];
  heading(): string | undefined;
  mode(): "replace" | "extend" | undefined;
  omitted: ReadonlySet<string>;
}

const surfaces: SurfaceEntry[] = [];
const registrations: RegistrationEntry[] = [];

export function clearRegistry(): void {
  surfaces.length = 0;
  registrations.length = 0;
}

export function activeSurfaces(): readonly SurfaceEntry[] {
  return surfaces.filter((entry) => entry.alive);
}

export function registrationFor(element: Element): RegistrationEntry | undefined {
  return registrations.find((entry) => entry.targets().includes(element));
}

export function trackedRegisterControls(config: RegisterControlsConfig): ControlsRegistrationHandle {
  const omitted = new Set(config.controls.filter((control) => control.currentValue === undefined).map((control) => control.callback));
  const handle = registerControlsRules(config);
  const entry: RegistrationEntry = {
    targets: () => readControls(handle).targets,
    controls: () => readControls(handle).controls,
    heading: () => readControls(handle).controlsHeading,
    mode: () => readControls(handle).controlsMode,
    omitted,
  };
  registrations.push(entry);
  const dispose = handle.dispose.bind(handle);
  handle.dispose = () => {
    dispose();
    const index = registrations.indexOf(entry);
    if (index >= 0) registrations.splice(index, 1);
  };
  return handle;
}

export function trackedRegisterSurface(config: RegisterSurfaceConfig): SurfaceRegistrationHandle {
  const handle = registerSurfaceRules(config);
  const entry: SurfaceEntry = {
    element: config.element,
    hitTest: config.hitTest,
    renderSelection: config.renderSelection,
    alive: true,
  };
  surfaces.push(entry);
  return {
    invalidate() {
      handle.invalidate();
    },
    dispose() {
      entry.alive = false;
      handle.dispose();
    },
  };
}
