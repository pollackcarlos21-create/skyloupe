import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { AnnotationBundle } from "./promptFormatter";
import { formatAnnotationPrompt } from "./promptFormatter";

export interface CodexTurnUpdate {
  status?: string;
  turnId?: string;
  delta?: string;
  files: string[];
  message: string;
}

export interface CodexTransport {
  write(line: string): void;
  close(): void;
}

export interface SubmittedTurn {
  threadId: string;
  turnId?: string;
  prompt: string;
  imagePath?: string;
  files: string[];
  status?: string;
}

const SANDBOX = {
  type: "workspaceWrite",
  networkAccess: false,
} as const;

export class CodexAppServer {
  readonly sent: unknown[] = [];
  private nextId = 1;
  private pending = new Map<number, (message: Record<string, unknown>) => void>();
  private threadId: string | undefined;
  private busy = false;
  private queue: Array<{ bundle: AnnotationBundle; imagePath?: string; resolve: (turn: SubmittedTurn) => void }> = [];
  private files: string[] = [];
  private completed: string | undefined;
  private readonly listeners = new Set<(update: CodexTurnUpdate) => void>();

  constructor(
    private readonly transport: CodexTransport,
    private readonly options: { cwd: string; model?: string },
  ) {}

  onUpdate(listener: (update: CodexTurnUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    const message = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof message.id === "number" && this.pending.has(message.id)) {
      this.pending.get(message.id)?.(message);
      this.pending.delete(message.id);
    }
    this.consume(message);
  }

  async handshake(): Promise<Record<string, unknown>> {
    return this.request(0, "initialize", {
      clientInfo: {
        name: "skyloupe",
        title: "SkyLoupe Browser Annotation Bridge",
        version: "0.1.0",
      },
    }).then((result) => {
      this.notify("initialized", {});
      return result;
    });
  }

  async submit(bundle: AnnotationBundle, imagePath?: string): Promise<SubmittedTurn> {
    return new Promise((resolve) => {
      this.queue.push({ bundle, imagePath, resolve });
      void this.pump();
    });
  }

  forgetThread(): void {
    this.threadId = undefined;
  }

  private async pump(): Promise<void> {
    if (this.busy || this.queue.length === 0) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    this.files = [];
    this.completed = undefined;
    if (!this.threadId) {
      const started = await this.request(this.nextId++, "thread/start", {
        cwd: this.options.cwd,
        approvalPolicy: "never",
        sandbox: "workspace-write",
        serviceName: "skyloupe",
        ...(this.options.model ? { model: this.options.model } : {}),
      });
      const thread = (started.thread ?? {}) as { id?: string };
      if (!thread.id) throw new Error("thread/start did not return thread.id");
      this.threadId = thread.id;
    }
    const input: Array<Record<string, string>> = [{ type: "text", text: formatAnnotationPrompt(job.bundle) }];
    if (job.imagePath) input.push({ type: "localImage", path: job.imagePath });
    const turn = await this.request(this.nextId++, "turn/start", {
      threadId: this.threadId,
      cwd: this.options.cwd,
      sandboxPolicy: { ...SANDBOX, writableRoots: [this.options.cwd] },
      input,
    });
    const turnId = ((turn.turn ?? {}) as { id?: string }).id;
    const finished = await this.waitForCompletion();
    this.busy = false;
    job.resolve({
      threadId: this.threadId,
      turnId,
      prompt: formatAnnotationPrompt(job.bundle),
      imagePath: job.imagePath,
      files: [...this.files],
      status: finished,
    });
    void this.pump();
  }

  private waitForCompletion(): Promise<string | undefined> {
    if (this.completed) return Promise.resolve(this.completed);
    return new Promise((resolve) => {
      const stop = this.onUpdate((update) => {
        if (update.status) {
          stop();
          resolve(update.status);
        }
      });
    });
  }

  private consume(message: Record<string, unknown>): void {
    if (message.method === "item/agentMessage/delta") {
      const params = (message.params ?? {}) as { delta?: string };
      this.emit({ files: [...this.files], delta: params.delta, message: params.delta ?? "" });
    }
    if (message.method === "item/started" || message.method === "item/completed") {
      const params = (message.params ?? {}) as { item?: { type?: string; changes?: Array<{ path?: string }> } };
      if (params.item?.type === "fileChange") {
        for (const change of params.item.changes ?? []) {
          if (change.path && !this.files.includes(change.path)) this.files.push(change.path);
        }
        this.emit({ files: [...this.files], message: this.files.join(", ") });
      }
    }
    if (message.method === "turn/completed") {
      const params = (message.params ?? {}) as { turn?: { id?: string; status?: string } };
      this.completed = params.turn?.status;
      this.emit({
        files: [...this.files],
        status: params.turn?.status,
        turnId: params.turn?.id,
        message: params.turn?.status ?? "",
      });
    }
  }

  private emit(update: CodexTurnUpdate): void {
    for (const listener of this.listeners) listener(update);
  }

  private request(id: number, method: string, params: unknown): Promise<Record<string, unknown>> {
    this.write({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, (message) => {
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve((message.result ?? {}) as Record<string, unknown>);
      });
    });
  }

  private notify(method: string, params: unknown): void {
    this.write({ method, params });
  }

  private write(message: { id?: number; method: string; params?: unknown }): void {
    if ("jsonrpc" in message) throw new Error("jsonrpc is not allowed on the Codex wire");
    this.sent.push(message);
    this.transport.write(`${JSON.stringify(message)}\n`);
  }
}

export function spawnCodexAppServer(bin = "codex"): ChildProcess {
  return spawn(bin, ["app-server"], { stdio: ["pipe", "pipe", "inherit"] });
}

export function attachChild(child: ChildProcess, session: CodexAppServer): void {
  if (!child.stdout) return;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => session.handleLine(line));
}

export function openCodexSocket(url: string, onLine: (line: string) => void): Promise<CodexTransport> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      resolve({
        write(line: string) {
          socket.send(line);
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("message", (event) => {
      for (const line of String(event.data).split("\n")) if (line.trim()) onLine(line);
    });
    socket.addEventListener("error", () => reject(new Error("codex websocket failed")));
  });
}
