export const version = "0.0.0" as const;

export { installPolyfill, mountDevtools, resetDevtools } from "./polyfill/installPolyfill";
export type { DevtoolsMode } from "./polyfill/installPolyfill";
