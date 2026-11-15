import { e as AnnotationControlDefinition, f as AnnotationMetadata, i as ControlsRegistrationHandle, k as RegisterControlsConfig, l as RegisterSurfaceConfig, o as SurfaceRegistrationHandle, h as AnnotationRequestOptions, c as AnnotationAcceptance, m as SelectControl } from './types-CTnLsmSJ.js';

declare const CALLBACK_NAME: RegExp;
declare const REFERENCE_NAME: RegExp;
declare const FORBIDDEN_TEXT: RegExp;

interface Diagnostic {
    code: string;
    message: string;
    field: string;
    severity: "error" | "warning";
}
interface SelectTransport {
    preview: string;
    record: string;
    unchangedExplicitChoice: boolean;
}
interface ControlsSnapshot {
    targets: readonly Element[];
    controls: readonly AnnotationControlDefinition[];
    controlsHeading?: string;
    controlsMode?: "replace" | "extend";
}
type AnnotationGesture = "element" | "text";
declare function selectTransport(control: SelectControl): SelectTransport;
declare function resetCoreState(): void;
declare function diagnoseAnnotatable(element: Element): Diagnostic[];
declare function resolveAnnotationGesture(element: Element): AnnotationGesture | undefined;
declare function validateMetadata(input: unknown): {
    metadata?: AnnotationMetadata;
    diagnostics: Diagnostic[];
};
declare function consumeMetadata(input: unknown): {
    metadata?: AnnotationMetadata;
    diagnostics: Diagnostic[];
};
declare function metadataIgnoredForTarget(target: Element | Range): boolean;
declare function isAnnotationActive(): boolean;
declare function toggleAnnotation(force?: boolean): AnnotationAcceptance;
declare function requestAnnotation(target: Element | Range, options?: AnnotationRequestOptions): AnnotationAcceptance;
declare function bindAnnotationGuards(): () => void;
declare function readControls(handle: ControlsRegistrationHandle): ControlsSnapshot;
declare function registerControls(config: RegisterControlsConfig): ControlsRegistrationHandle;
declare function registerSurface(config: RegisterSurfaceConfig): SurfaceRegistrationHandle;

export { type AnnotationGesture, CALLBACK_NAME, type ControlsSnapshot, type Diagnostic, FORBIDDEN_TEXT, REFERENCE_NAME, type SelectTransport, bindAnnotationGuards, consumeMetadata, diagnoseAnnotatable, isAnnotationActive, metadataIgnoredForTarget, readControls, registerControls, registerSurface, requestAnnotation, resetCoreState, resolveAnnotationGesture, selectTransport, toggleAnnotation, validateMetadata };
