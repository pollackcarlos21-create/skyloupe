import { Configuration } from '@skyloupe/webpack';

interface NextContext {
    dev: boolean;
    dir: string;
    isServer: boolean;
}
interface NextConfig {
    webpack?: (config: Configuration, context: NextContext) => Configuration;
}
declare function withSkyloupe<T extends NextConfig>(nextConfig?: T): T;

export { type NextConfig, type NextContext, withSkyloupe };
