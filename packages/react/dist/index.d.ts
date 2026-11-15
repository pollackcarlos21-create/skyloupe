import { AnnotationControlDefinition, PreviewBinding, AnnotationMetadata, SurfaceRect, SurfaceHitTestResult, AnnotationControlChangeDetail } from '@skyloupe/core';
export { version as coreVersion } from '@skyloupe/core';
import * as react from 'react';
import { HTMLAttributes, ReactNode, ReactElement, CanvasHTMLAttributes } from 'react';

type TagName$1 = keyof HTMLElementTagNameMap;
declare function AnnotationContainer({ as, textSelection, children, ...rest }: HTMLAttributes<HTMLElement> & {
    as?: TagName$1;
    textSelection?: boolean;
    children?: ReactNode;
}): ReactElement;

type TagName = keyof HTMLElementTagNameMap;
declare const Annotatable: react.ForwardRefExoticComponent<HTMLAttributes<HTMLElement> & {
    as?: TagName;
    name?: string;
    metadata?: Record<string, unknown>;
    children?: ReactNode;
} & react.RefAttributes<HTMLElement>>;

type PreviewControl = AnnotationControlDefinition & {
    cssVar?: string;
    unit?: string;
    onApply?: PreviewBinding["onApply"];
};

interface VirtualObject {
    id: string;
    name?: string;
    role?: string;
    metadata?: AnnotationMetadata;
    rect: SurfaceRect;
    radius?: number;
    controlState?: Readonly<Record<string, string | number | boolean>>;
}
type HitTestFn = (args: {
    clientX: number;
    clientY: number;
    canvasX: number;
    canvasY: number;
    signal: AbortSignal;
}) => SurfaceHitTestResult | null | Promise<SurfaceHitTestResult | null>;
declare function AnnotatableCanvas({ virtualObjects, hitTest, renderSelection, controls, controlsHeading, controlsMode, onControlChange, ...rest }: CanvasHTMLAttributes<HTMLCanvasElement> & {
    virtualObjects?: readonly VirtualObject[];
    hitTest?: HitTestFn;
    renderSelection?: (args: {
        hoveredId: string | null;
        selectedId: string | null;
    }) => void;
    controls?: PreviewControl[];
    controlsHeading?: string;
    controlsMode?: "replace" | "extend";
    onControlChange?: (detail: AnnotationControlChangeDetail, object: VirtualObject | undefined) => void;
}): ReactElement;

interface ElementRef {
    readonly current: Element | null;
}
interface AnnotationControlsConfig {
    controlsHeading?: string;
    controlsMode?: "replace" | "extend";
    controls: PreviewControl[];
}
declare function useAnnotationControls(target: ElementRef | readonly ElementRef[], config: AnnotationControlsConfig): void;

declare function useAnnotationMode(): boolean;

declare const version: "0.2.0";

export { Annotatable, AnnotatableCanvas, AnnotationContainer, type AnnotationControlsConfig, type ElementRef, type VirtualObject, useAnnotationControls, useAnnotationMode, version };
