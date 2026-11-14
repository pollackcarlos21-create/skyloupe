export type AnnotationPrimitive = string | number | boolean | null;
export type AnnotationMetadata = Record<string, AnnotationPrimitive>;

export interface AnnotationRequestOptions {
  mode?: "default" | "advanced";
  enterAnnotationMode?: boolean;
  omitScreenshot?: boolean;
  metadata?: AnnotationMetadata;
  initialComment?: string;
}

export interface AnnotationAcceptance {
  accepted: boolean;
}

export interface ColorControl {
  type: "color";
  label: string;
  callback: string;
  reference?: string;
  currentValue?: string;
  defaultValue?: string;
}

export interface RangeControl {
  type: "range";
  label: string;
  callback: string;
  reference?: string;
  min: number;
  max: number;
  step: number;
  currentValue?: number;
  defaultValue?: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectControl {
  type: "select";
  label: string;
  callback: string;
  reference?: string;
  options: SelectOption[];
  currentValue?: string;
  defaultValue?: string;
}

export interface ToggleControl {
  type: "toggle";
  label: string;
  callback: string;
  reference?: string;
  currentValue?: boolean;
  defaultValue?: boolean;
}

export type AnnotationControlDefinition = ColorControl | RangeControl | SelectControl | ToggleControl;

export type ControlsTargetInput = Element | readonly Element[] | NodeListOf<Element>;

export interface RegisterControlsConfig {
  targets: ControlsTargetInput;
  controlsHeading?: string;
  controlsMode?: "replace" | "extend";
  controls: AnnotationControlDefinition[];
}

export interface UpdateControlsConfig {
  targets?: ControlsTargetInput;
  controlsHeading?: string;
  controlsMode?: "replace" | "extend";
  controls?: AnnotationControlDefinition[];
}

export interface ControlsRegistrationHandle {
  update(config: UpdateControlsConfig): void;
  dispose(): void;
}

export interface SurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurfaceHitTestArgs {
  clientX: number;
  clientY: number;
  signal: AbortSignal;
}

export interface SurfaceHitTestResult {
  id: string;
  name?: string;
  role?: string;
  metadata?: AnnotationMetadata;
  rect?: SurfaceRect;
}

export interface SurfaceRenderSelectionArgs {
  hoveredId: string | null;
  selectedId: string | null;
}

export interface RegisterSurfaceConfig {
  element: HTMLElement;
  hitTest(
    args: SurfaceHitTestArgs,
  ): SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>;
  renderSelection?(args: SurfaceRenderSelectionArgs): void;
}

export interface SurfaceRegistrationHandle {
  invalidate(): void;
  dispose(): void;
}

export type AnnotationControlAction = "preview" | "preview-original" | "reset";

export interface AnnotationControlChangeDetail {
  callback: string;
  value: string | number | boolean;
  action: AnnotationControlAction;
  virtualTarget?: {
    surfaceId: string;
    targetId: string;
  };
}

export interface OaiAnnotationNamespace {
  isActive(): boolean;
  toggle(force?: boolean): AnnotationAcceptance;
  request(target: Element | Range, options?: AnnotationRequestOptions): AnnotationAcceptance;
  registerControls(config: RegisterControlsConfig): ControlsRegistrationHandle;
  registerSurface(config: RegisterSurfaceConfig): SurfaceRegistrationHandle;
}

declare global {
  interface Document {
    oai?: {
      annotation?: OaiAnnotationNamespace;
    };
  }
}
