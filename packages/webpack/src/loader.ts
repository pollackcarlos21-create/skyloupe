import { transformModule } from "./transform";

interface LoaderContext {
  resourcePath: string;
  mode?: string;
  getOptions?: () => { root?: string };
}

export default function skyloupeLoader(this: LoaderContext, source: string): string {
  const options = this.getOptions?.() ?? {};
  const dev = this.mode ? this.mode !== "production" : process.env.NODE_ENV !== "production";
  return transformModule(source, this.resourcePath, { root: options.root ?? process.cwd(), dev });
}
