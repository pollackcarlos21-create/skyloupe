import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAnnotation, listPending, resolveAnnotation } from "../bridge/store";

export const mcpToolNames = ["list_pending_annotations", "get_annotation", "resolve_annotation"] as const;

export function createMcpServer(repoRoot: string): McpServer {
  const server = new McpServer({ name: "skyloupe", version: "0.2.0" });
  server.registerTool("list_pending_annotations", {
    description: "List pending SkyLoupe annotation summaries.",
  }, async () => ({
    content: [{
      type: "text" as const,
      text: JSON.stringify(listPending(repoRoot).map((item) => ({
        id: item.id,
        comment: item.bundle.comment,
        target: item.bundle.target,
      }))),
    }],
  }));
  server.registerTool("get_annotation", {
    description: "Return one SkyLoupe annotation, including its screenshot path.",
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    const item = getAnnotation(repoRoot, id);
    return { content: [{ type: "text" as const, text: JSON.stringify(item ?? null) }] };
  });
  server.registerTool("resolve_annotation", {
    description: "Mark an annotation resolved and record the fix summary.",
    inputSchema: { id: z.string(), summary: z.string() },
  }, async ({ id, summary }) => {
    const item = resolveAnnotation(repoRoot, id, summary);
    return { content: [{ type: "text" as const, text: JSON.stringify(item ?? null) }] };
  });
  return server;
}

export async function startMcp(repoRoot: string): Promise<void> {
  const server = createMcpServer(repoRoot);
  await server.connect(new StdioServerTransport());
}
