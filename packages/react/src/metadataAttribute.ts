import { validateMetadata } from "@skyloupe/core/validators";

export function metadataAttribute(metadata: unknown, source?: string): string | undefined {
  if (metadata === undefined) return undefined;
  if (process.env.NODE_ENV !== "production") {
    const result = validateMetadata(metadata);
    if (result.diagnostics.length > 0) {
      const codes = result.diagnostics.map((item) => item.code).join(", ");
      console.warn(`[SkyLoupe] ${codes} metadata ignored${source ? ` (${source})` : ""}`);
      return undefined;
    }
    return JSON.stringify(result.metadata ?? {});
  }
  return JSON.stringify(metadata);
}
