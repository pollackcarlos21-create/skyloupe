import { createElement, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

type TagName = keyof HTMLElementTagNameMap;

export function AnnotationContainer({
  as = "div",
  textSelection = false,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: TagName;
  textSelection?: boolean;
  children?: ReactNode;
}): ReactElement {
  const attribute = textSelection
    ? { "oai-annotation-container-text": "" }
    : { "oai-annotation-container": "" };
  return createElement(as, { ...rest, ...attribute }, children);
}
