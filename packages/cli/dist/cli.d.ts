declare const version: "0.2.0";
declare function main(argv: readonly string[], write?: (text: string) => void): Promise<number>;

export { main, version };
