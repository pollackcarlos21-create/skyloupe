import { A as AnnotationControlChangeDetail, S as SurfaceHitTestArgs, a as SurfaceHitTestResult, b as SurfaceRect, O as OaiAnnotationNamespace } from './types-CTnLsmSJ.js';
export { c as AnnotationAcceptance, d as AnnotationControlAction, e as AnnotationControlDefinition, f as AnnotationMetadata, g as AnnotationPrimitive, h as AnnotationRequestOptions, C as ColorControl, i as ControlsRegistrationHandle, j as ControlsTargetInput, R as RangeControl, k as RegisterControlsConfig, l as RegisterSurfaceConfig, m as SelectControl, n as SelectOption, o as SurfaceRegistrationHandle, p as SurfaceRenderSelectionArgs, T as ToggleControl, U as UpdateControlsConfig } from './types-CTnLsmSJ.js';

interface PreviewBinding {
    callback: string;
    cssVar?: string;
    unit?: string;
    onApply?: (value: string | number | boolean, element: Element) => void;
}
interface PreviewManager {
    apply(detail: AnnotationControlChangeDetail, element: Element, binding: PreviewBinding): void;
    dispose(element: Element): void;
}
declare function createPreviewManager(): PreviewManager;

interface SurfaceDiagnostic {
    code: string;
    message: string;
    field: string;
    severity: "error" | "warning";
}
interface SafeHitTestArgs extends SurfaceHitTestArgs {
    canvasX: number;
    canvasY: number;
}
type CanvasRef = HTMLCanvasElement | {
    current: HTMLCanvasElement | null;
};
interface SafeHitTest {
    hitTest(args: SurfaceHitTestArgs): Promise<SurfaceHitTestResult | null>;
    toViewportRect(canvasRect: SurfaceRect): SurfaceRect;
}
declare function surfaceDiagnostics(): readonly SurfaceDiagnostic[];
declare function runHitTest(hitTest: (args: SurfaceHitTestArgs) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>, args: SurfaceHitTestArgs): Promise<SurfaceHitTestResult | null>;
declare function createSafeHitTest(canvasRef: CanvasRef, userHitTest: (args: SafeHitTestArgs) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>): SafeHitTest;

declare function isSecureTopLocation(protocol: string, hostname: string, isTop: boolean): boolean;
declare function canInjectAnnotationApi(): boolean;
declare function nativeAnnotation(): OaiAnnotationNamespace | undefined;

declare const version: "0.2.0";

export { AnnotationControlChangeDetail, type CanvasRef, OaiAnnotationNamespace, type PreviewBinding, type PreviewManager, type SafeHitTest, type SafeHitTestArgs, SurfaceHitTestArgs, SurfaceHitTestResult, SurfaceRect, canInjectAnnotationApi, createPreviewManager, createSafeHitTest, isSecureTopLocation, nativeAnnotation, runHitTest, surfaceDiagnostics, version };
