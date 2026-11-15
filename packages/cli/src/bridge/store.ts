import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AnnotationBundle } from "./promptFormatter";

export interface QueuedAnnotation {
  id: string;
  status: "pending" | "resolved";
  bundle: AnnotationBundle;
  summary?: string;
  imagePath?: string;
}

export function queuePath(repoRoot: string): string {
  return join(repoRoot, ".skyloupe", "queue.json");
}

export function readQueue(repoRoot: string): QueuedAnnotation[] {
  try {
    const parsed = JSON.parse(readFileSync(queuePath(repoRoot), "utf8")) as { items?: QueuedAnnotation[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export function writeQueue(repoRoot: string, items: readonly QueuedAnnotation[]): void {
  const dir = join(repoRoot, ".skyloupe");
  mkdirSync(dir, { recursive: true });
  writeFileSync(queuePath(repoRoot), JSON.stringify({ items }, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function enqueue(repoRoot: string, item: QueuedAnnotation): void {
  const items = readQueue(repoRoot).filter((entry) => entry.id !== item.id);
  items.push(item);
  writeQueue(repoRoot, items);
}

export function listPending(repoRoot: string): QueuedAnnotation[] {
  return readQueue(repoRoot).filter((item) => item.status === "pending");
}

export function getAnnotation(repoRoot: string, id: string): QueuedAnnotation | undefined {
  return readQueue(repoRoot).find((item) => item.id === id);
}

export function resolveAnnotation(repoRoot: string, id: string, summary: string): QueuedAnnotation | undefined {
  const items = readQueue(repoRoot);
  const found = items.find((item) => item.id === id);
  if (!found) return undefined;
  found.status = "resolved";
  found.summary = summary;
  writeQueue(repoRoot, items);
  return found;
}
