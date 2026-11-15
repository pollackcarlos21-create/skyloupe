import { Plugin } from 'vite';

declare const VIRTUAL_SESSION_ID = "virtual:skyloupe/session";
interface SkyLoupeSession {
    port: number;
    token: string;
}
declare function readSession(root: string): SkyLoupeSession | null;
declare function sessionModuleSource(session: SkyLoupeSession | null): string;
declare function injectSourceAttributes(code: string, file: string): string | null;
declare function skyloupe(): Plugin;

export { type SkyLoupeSession, VIRTUAL_SESSION_ID, skyloupe as default, injectSourceAttributes, readSession, sessionModuleSource, skyloupe };
