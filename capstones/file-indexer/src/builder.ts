import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { mergeIndexes, type FileIndex, type Index } from "./model.js";
import type { WorkerReply } from "./worker.js";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".ts", ".js", ".json", ".css", ".html"]);

/** Recursively lists indexable text files, skipping dot-folders and node_modules. */
export async function findFiles(root: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (TEXT_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) found.push(full);
    }
  }
  await walk(root);
  return found;
}

export interface BuildOptions {
  /** Number of worker threads (default 4). */
  concurrency?: number;
}

export interface BuildResult {
  index: Index;
  errors: { path: string; error: string }[];
}

/**
 * Indexes `paths` on a pool of worker threads. Each worker handles one file
 * at a time; when it replies, it is handed the next path from the queue.
 */
export async function buildIndex(paths: string[], options: BuildOptions = {}): Promise<BuildResult> {
  const size = Math.max(1, Math.min(options.concurrency ?? 4, paths.length));
  const queue = [...paths];
  const parts: FileIndex[] = [];
  const errors: BuildResult["errors"] = [];
  if (paths.length === 0) return { index: mergeIndexes([]), errors };

  const workerUrl = new URL("./worker.js", import.meta.url);

  await new Promise<void>((resolve, reject) => {
    const workers: Worker[] = [];
    let pending = paths.length;

    const finish = (error?: Error): void => {
      for (const w of workers) void w.terminate();
      if (error) reject(error);
      else resolve();
    };

    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerUrl);
      workers.push(worker);

      worker.on("message", (reply: WorkerReply) => {
        if (reply.ok) parts.push(reply.result);
        else errors.push({ path: reply.path, error: reply.error });
        if (--pending === 0) return finish();
        const next = queue.shift();
        if (next !== undefined) worker.postMessage(next);
      });
      worker.on("error", finish);

      const first = queue.shift();
      if (first !== undefined) worker.postMessage(first);
    }
  });

  errors.sort((a, b) => a.path.localeCompare(b.path));
  return { index: mergeIndexes(parts), errors };
}
