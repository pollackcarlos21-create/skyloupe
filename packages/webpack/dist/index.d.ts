interface Configuration {
    module?: {
        rules?: unknown[];
    };
    plugins?: unknown[];
}

declare function transformModule(code: string, file: string, options: {
    root: string;
    dev: boolean;
}): string;
declare function injectSession(code: string, sessionSource: string): string;

interface SkyloupeWebpackOptions {
    dev: boolean;
    root: string;
}
declare function applySkyloupeWebpack(config: Configuration, options: SkyloupeWebpackOptions): Configuration;

export { type Configuration, type SkyloupeWebpackOptions, applySkyloupeWebpack, injectSession, transformModule };
