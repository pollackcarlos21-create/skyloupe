import { pathToFileURL } from "node:url";

export const version = "0.0.0" as const;

export function main(
  argv: readonly string[],
  write: (text: string) => void = (text) => {
    process.stdout.write(text);
  },
): number {
  if (argv.includes("--version") || argv.includes("-V")) {
    write(`${version}\n`);
    return 0;
  }
  write("skyloupe\n");
  return 0;
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(invoked).href) {
  process.exitCode = main(process.argv.slice(2));
}
