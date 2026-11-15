type AnnotationPrimitive = string | number | boolean | null;
type AnnotationMetadata = Record<string, AnnotationPrimitive>;
interface AnnotationRequestOptions {
    mode?: "default" | "advanced";
    enterAnnotationMode?: boolean;
    omitScreenshot?: boolean;
    metadata?: AnnotationMetadata;
    initialComment?: string;
}
interface AnnotationAcceptance {
    accepted: boolean;
}
interface ColorControl {
    type: "color";
    label: string;
    callback: string;
    reference?: string;
    currentValue?: string;
    defaultValue?: string;
}
interface RangeControl {
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
interface SelectOption {
    label: string;
    value: string;
}
interface SelectControl {
    type: "select";
    label: string;
    callback: string;
    reference?: string;
    options: SelectOption[];
    currentValue?: string;
    defaultValue?: string;
}
interface ToggleControl {
    type: "toggle";
    label: string;
    callback: string;
    reference?: string;
    currentValue?: boolean;
    defaultValue?: boolean;
}
type AnnotationControlDefinition = ColorControl | RangeControl | SelectControl | ToggleControl;
type ControlsTargetInput = Element | readonly Element[] | NodeListOf<Element>;
interface RegisterControlsConfig {
    targets: ControlsTargetInput;
    controlsHeading?: string;
    controlsMode?: "replace" | "extend";
    controls: AnnotationControlDefinition[];
}
interface UpdateControlsConfig {
    targets?: ControlsTargetInput;
    controlsHeading?: string;
    controlsMode?: "replace" | "extend";
    controls?: AnnotationControlDefinition[];
}
interface ControlsRegistrationHandle {
    update(config: UpdateControlsConfig): void;
    dispose(): void;
}
interface SurfaceRect {
    x: number;
    y: number;
    width: number;
    height: number;
}
interface SurfaceHitTestArgs {
    clientX: number;
    clientY: number;
    signal: AbortSignal;
}
interface SurfaceHitTestResult {
    id: string;
    name?: string;
    role?: string;
    metadata?: AnnotationMetadata;
    rect?: SurfaceRect;
}
interface SurfaceRenderSelectionArgs {
    hoveredId: string | null;
    selectedId: string | null;
}
interface RegisterSurfaceConfig {
    element: HTMLElement;
    hitTest(args: SurfaceHitTestArgs): SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>;
    renderSelection?(args: SurfaceRenderSelectionArgs): void;
}
interface SurfaceRegistrationHandle {
    invalidate(): void;
    dispose(): void;
}
type AnnotationControlAction = "preview" | "preview-original" | "reset";
interface AnnotationControlChangeDetail {
    callback: string;
    value: string | number | boolean;
    action: AnnotationControlAction;
    virtualTarget?: {
        surfaceId: string;
        targetId: string;
    };
}
interface OaiAnnotationNamespace {
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

export type { AnnotationControlChangeDetail as A, ColorControl as C, OaiAnnotationNamespace as O, RangeControl as R, SurfaceHitTestArgs as S, ToggleControl as T, UpdateControlsConfig as U, SurfaceHitTestResult as a, SurfaceRect as b, AnnotationAcceptance as c, AnnotationControlAction as d, AnnotationControlDefinition as e, AnnotationMetadata as f, AnnotationPrimitive as g, AnnotationRequestOptions as h, ControlsRegistrationHandle as i, ControlsTargetInput as j, RegisterControlsConfig as k, RegisterSurfaceConfig as l, SelectControl as m, SelectOption as n, SurfaceRegistrationHandle as o, SurfaceRenderSelectionArgs as p };
