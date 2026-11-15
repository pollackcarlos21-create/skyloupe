export { version as coreVersion } from "@skyloupe/core";

export const version = "0.0.0" as const;

export { AnnotationContainer } from "./AnnotationContainer";
export { Annotatable } from "./Annotatable";
export { AnnotatableCanvas, type VirtualObject } from "./AnnotatableCanvas";
export { useAnnotationControls, type AnnotationControlsConfig, type ElementRef } from "./useAnnotationControls";
export { useAnnotationMode } from "./useAnnotationMode";
