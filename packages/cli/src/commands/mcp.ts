import { startMcp } from "../mcp/server";

export function runMcp(repoRoot: string): Promise<void> {
  return startMcp(repoRoot);
}
