interface LoaderContext {
    resourcePath: string;
    mode?: string;
    getOptions?: () => {
        root?: string;
    };
}
declare function skyloupeLoader(this: LoaderContext, source: string): string;

export { skyloupeLoader as default };
