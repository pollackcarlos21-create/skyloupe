export const version = "0.0.0" as const;

export type {
  AnnotationAcceptance,
  AnnotationControlAction,
  AnnotationControlChangeDetail,
  AnnotationControlDefinition,
  AnnotationMetadata,
  AnnotationPrimitive,
  AnnotationRequestOptions,
  ColorControl,
  ControlsRegistrationHandle,
  ControlsTargetInput,
  OaiAnnotationNamespace,
  RangeControl,
  RegisterControlsConfig,
  RegisterSurfaceConfig,
  SelectControl,
  SelectOption,
  SurfaceHitTestArgs,
  SurfaceHitTestResult,
  SurfaceRect,
  SurfaceRegistrationHandle,
  SurfaceRenderSelectionArgs,
  ToggleControl,
  UpdateControlsConfig,
} from "./types";

export type { PreviewBinding, PreviewManager } from "./previewManager";
export type { CanvasRef, SafeHitTest, SafeHitTestArgs } from "./surfaceGuard";

export { canInjectAnnotationApi, isSecureTopLocation, nativeAnnotation } from "./runtime";
export { createPreviewManager } from "./previewManager";
export { createSafeHitTest, runHitTest, surfaceDiagnostics } from "./surfaceGuard";
