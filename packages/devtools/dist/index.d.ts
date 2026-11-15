type DevtoolsMode = "polyfill-standalone" | "native-companion" | "native-passthrough";
declare function resetDevtools(): void;
declare function installPolyfill(options?: {
    inspector?: boolean;
}): DevtoolsMode;
declare function mountDevtools(options?: {
    inspector?: boolean;
}): DevtoolsMode;

declare const version: "0.2.0";

export { type DevtoolsMode, installPolyfill, mountDevtools, resetDevtools, version };
