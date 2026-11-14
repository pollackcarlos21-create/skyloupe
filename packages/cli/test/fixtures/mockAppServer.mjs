import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    write({
      id: message.id,
      result: { userAgent: "test", platformFamily: "unix", platformOs: "linux" },
    });
  }
  if (message.method === "thread/start") {
    write({ id: message.id, result: { thread: { id: "thr_123" } } });
  }
  if (message.method === "turn/start") {
    write({ id: message.id, result: { turn: { id: "turn_8f1a", status: "inProgress", items: [] } } });
    write({
      method: "item/agentMessage/delta",
      params: { delta: "Editing tokens", itemId: "item_1", threadId: "thr_123", turnId: "turn_8f1a" },
    });
    write({
      method: "item/completed",
      params: {
        completedAtMs: 1,
        threadId: "thr_123",
        turnId: "turn_8f1a",
        item: {
          type: "fileChange",
          id: "item_2",
          status: "completed",
          changes: [{ path: "src/styles/tokens.css", kind: { type: "update" }, diff: "" }],
        },
      },
    });
    write({
      method: "turn/completed",
      params: { threadId: "thr_123", turn: { id: "turn_8f1a", status: "completed", items: [] } },
    });
  }
});

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
