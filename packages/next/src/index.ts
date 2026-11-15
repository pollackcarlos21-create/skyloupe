import { applySkyloupeWebpack, type Configuration } from "@skyloupe/webpack";

export interface NextContext {
  dev: boolean;
  dir: string;
  isServer: boolean;
}

export interface NextConfig {
  webpack?: (config: Configuration, context: NextContext) => Configuration;
}

export function withSkyloupe<T extends NextConfig>(nextConfig: T = {} as T): T {
  return {
    ...nextConfig,
    webpack(config: Configuration, context: NextContext) {
      const next = nextConfig.webpack?.(config, context) ?? config;
      if (context.dev) applySkyloupeWebpack(next, { dev: true, root: context.dir });
      return next;
    },
  };
}
