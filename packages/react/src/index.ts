import { version as coreVersion } from "@skyloupe/core";
import type { ReactNode } from "react";

export const version = "0.0.0" as const;

export { coreVersion };

export interface SkyLoupeRootProps {
  children?: ReactNode;
}
