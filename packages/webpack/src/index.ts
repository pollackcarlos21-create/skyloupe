import type { Configuration } from "./types";

export type { Configuration } from "./types";
export { transformModule, injectSession } from "./transform";

export interface SkyloupeWebpackOptions {
  dev: boolean;
  root: string;
}

export function applySkyloupeWebpack(config: Configuration, options: SkyloupeWebpackOptions): Configuration {
  if (!options.dev) return config;
  config.module ??= {};
  config.module.rules ??= [];
  config.module.rules.push({
    test: /\.[jt]sx$/,
    enforce: "pre",
    exclude: /node_modules/,
    use: [{ loader: "@skyloupe/webpack/loader", options: { root: options.root } }],
  });
  return config;
}
