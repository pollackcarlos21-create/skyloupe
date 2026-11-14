import { createElement, forwardRef, type HTMLAttributes, type ReactElement, type ReactNode } from "react";
import { metadataAttribute } from "./metadataAttribute";

type TagName = keyof HTMLElementTagNameMap;

export const Annotatable = forwardRef<
  HTMLElement,
  HTMLAttributes<HTMLElement> & {
    as?: TagName;
    name?: string;
    metadata?: Record<string, unknown>;
    children?: ReactNode;
  }
>(function Annotatable({ as = "div", name = "", metadata, children, ...rest }, ref): ReactElement {
  const sourceAttr = (rest as { "data-skyloupe-source"?: unknown })["data-skyloupe-source"];
  const source = typeof sourceAttr === "string" ? sourceAttr : undefined;
  const serialized = metadataAttribute(metadata, source);
  const attributes: Record<string, unknown> = {
    ...rest,
    ref,
    "oai-annotatable": name,
  };
  if (serialized !== undefined) attributes["oai-annotation-metadata"] = serialized;
  return createElement(as, attributes, children);
});
