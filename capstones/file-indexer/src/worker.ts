import { readFile } from "node:fs/promises";
import { parentPort } from "node:worker_threads";
import { indexText, type FileIndex } from "./model.js";

export type WorkerReply =
  | { ok: true; result: FileIndex }
  | { ok: false; path: string; error: string };

const port = parentPort;
if (!port) throw new Error("worker.js must be run as a worker thread");

port.on("message", async (path: string) => {
  let reply: WorkerReply;
  try {
    reply = { ok: true, result: indexText(path, await readFile(path, "utf8")) };
  } catch (error) {
    reply = { ok: false, path, error: error instanceof Error ? error.message : String(error) };
  }
  port.postMessage(reply);
});
