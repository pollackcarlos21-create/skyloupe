import { relative } from "node:path";
import { injectSourceAttributes, readSession, sessionModuleSource } from "@skyloupe/vite";

export function transformModule(code: string, file: string, options: { root: string; dev: boolean }): string {
  if (!options.dev) return code;
  const rel = relative(options.root, file).split("\\").join("/");
  const stamped = injectSourceAttributes(code, rel.startsWith("..") ? file : rel) ?? code;
  if (!/(^|\/)(layout|main)\.[jt]sx$/.test(rel) && !/(^|\/)(layout|main)\.[jt]sx$/.test(file)) return stamped;
  return injectSession(stamped, sessionModuleSource(readSession(options.root)));
}

export function injectSession(code: string, sessionSource: string): string {
  const directive = code.match(/^\s*(['"])use client\1;?\s*/);
  if (!directive) return `${sessionSource}${code}`;
  return `${directive[0]}\n${sessionSource}${code.slice(directive[0].length)}`;
}
