# 12. Capstone: parallel file indexer

## Goal

Build a concurrent command-line tool that walks a directory tree, analyses every text file on a pool of **worker threads**, and merges the results into one report: totals for lines, words and bytes, plus the most frequent terms.

This exercises almost everything in the Advanced level: a typed message protocol, worker threads and a pool, bounded concurrency, order-independent merging for deterministic output, error isolation, `node:util` argument parsing, and tests that prove the result does not depend on scheduling.

The finished, tested source is in [`capstones/file-indexer`](https://github.com/HunterGHall/typescript-course/tree/main/capstones/file-indexer) and is built by CI on Linux, macOS and Windows.

## What it does

```
$ indexer -j 4 -n 5 docs/

Indexed 41 files: 9212 lines, 61833 words, 402118 bytes

Top 5 terms:
  4017  the
  2301  a
  1850  to
  1622  of
  1344  you
(4 threads, 38 ms)
```

Timing goes to **stderr** so that stdout is byte-for-byte identical at any thread count, which makes the tool easy to test and to diff.

## Requirements

1. Recursively find indexable text files (`.md .txt .ts .js .json .css .html`), skipping dot-folders and `node_modules`.
2. Analyse each file on a worker thread: byte count, line count, word count and a term-frequency table.
3. A fixed-size **pool** of workers (`-j <threads>`, default `os.availableParallelism()`); never one worker per file.
4. Merge into one index: files sorted by path, term counts summed.
5. Print totals and the top *N* terms (`-n`, default 10), ties broken alphabetically.
6. A file that can't be read is reported and counted as an error but **does not abort** the run.
7. Output must be **identical for any thread count**.
8. Exit codes: `0` success, `1` some files failed, `2` usage or I/O error.

## Project layout

```
file-indexer/
├── package.json
├── tsconfig.json
└── src/
    ├── model.ts          # pure: tokenize, indexText, mergeIndexes, topTerms
    ├── worker.ts         # the thread: receives a path, replies with a FileIndex
    ├── builder.ts        # findFiles + buildIndex (the pool)
    ├── main.ts           # arguments + report (thin)
    └── indexer.test.ts   # unit tests + real-thread integration tests
```

The same discipline as the link checker: **pure logic** (`model.ts`) that never touches threads or disk, a **concurrency layer** (`builder.ts` + `worker.ts`) that does nothing clever with the data, and a **thin entry point**. The worker simply calls the pure function `indexText`.

## Setup

Same project skeleton as the previous capstones (`"type": "module"`, strict `tsconfig`, `NodeNext`). The worker is a separate compiled file, so make sure `tsc` emits `dist/worker.js` alongside `dist/builder.js`.

## Step 1: the model (pure code)

The per-file result and the merged index are plain data; the functions are pure.

```ts
/** Statistics for one file. */
export interface FileStats {
  path: string;
  bytes: number;
  lines: number;
  words: number;
}

/** What a worker sends back for one file: its stats plus per-term counts. */
export interface FileIndex {
  stats: FileStats;
  terms: Record<string, number>;
}

/** The merged result for a whole directory tree. */
export interface Index {
  files: FileStats[]; // sorted by path
  terms: Map<string, number>; // term -> total occurrences
}

/** Lowercased words made of letters, digits and apostrophes. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

/** Pure: the whole per-file computation, so it can be tested without threads or disk. */
export function indexText(path: string, text: string): FileIndex {
  const words = tokenize(text);
  const terms: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const w of words) terms[w] = (terms[w] ?? 0) + 1;
  const lines = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  return {
    stats: { path, bytes: Buffer.byteLength(text), lines, words: words.length },
    terms,
  };
}

/** Order-independent merge: sorting by path makes the result identical for any scheduling. */
export function mergeIndexes(parts: FileIndex[]): Index {
  const files = parts.map((p) => p.stats).sort((a, b) => a.path.localeCompare(b.path));
  const terms = new Map<string, number>();
  for (const part of parts) {
    for (const [term, n] of Object.entries(part.terms)) {
      terms.set(term, (terms.get(term) ?? 0) + n);
    }
  }
  return { files, terms };
}

/** Most frequent terms; ties broken alphabetically so output is deterministic. */
export function topTerms(index: Index, n: number): [string, number][] {
  return [...index.terms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}
```

Things to study:

- **`FileIndex.terms` is a plain `Record`, not a `Map`.** It crosses a thread boundary by structured clone, and a plain object is the simplest thing that clones cheaply. The merged `Index` can use a `Map` because it never leaves the main thread.
- **`Object.create(null)`** makes the per-file table a prototype-free dictionary, so a word like `constructor` or `__proto__` is just another key, not a surprise.
- **`mergeIndexes` is order-independent.** Addition is commutative and the file list is sorted, so any arrival order gives the same `Index`. This is the heart of requirement 7.
- **`topTerms` breaks ties alphabetically**, otherwise equal counts would come out in `Map` insertion order, which depends on scheduling.

## Step 2: the worker

The worker is deliberately tiny: it loops on messages, calls the pure function, and replies with a tagged result.

```ts
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
```

Things to study:

- **The reply is a discriminated union** (`ok: true | false`). Both sides import the same type, so the protocol is checked at compile time. Errors are *data*, not thrown across the thread boundary, so one bad file can't kill a worker.
- **`import type`-only use** of `WorkerReply` from `builder.ts` means the worker module is not executed when the main thread imports its type. (If it were, it would throw on the `parentPort` check.)
- The `throw` at the top documents an invariant: this file is only meant to run as a worker.

## Step 3: the pool

`buildIndex` starts `size` workers, hands each a first path, and gives each its next path as soon as it replies — a **work-stealing queue** with no central scheduler:

```ts
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
```

Things to study:

- **Pool size** is `min(concurrency, paths.length)`, so a tiny job doesn't start idle threads, and `paths.length === 0` returns early (otherwise the promise would never resolve).
- **`pending` counts remaining files**, not workers. When it reaches zero, `finish()` terminates every worker and resolves once.
- **`new URL("./worker.js", import.meta.url)`** finds the compiled worker next to this module regardless of the current directory.
- **Error handling is layered:** a failure *reading a file* is an `ok: false` reply (recorded, run continues); a failure *of a worker itself* (`'error'` event) rejects the whole build.
- **Results arrive in any order**; nothing here depends on it, because `mergeIndexes` sorts. Remove the sort and watch the determinism test fail.

## Step 4: the command-line wrapper

```ts
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { buildIndex, findFiles } from "./builder.js";
import { topTerms } from "./model.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    jobs: { type: "string", short: "j", default: String(availableParallelism()) },
    top: { type: "string", short: "n", default: "10" },
  },
});

const jobs = Number(values.jobs);
const top = Number(values.top);
if (!Number.isInteger(jobs) || jobs < 1 || !Number.isInteger(top) || top < 1) {
  console.error("Usage: indexer [-j <threads>] [-n <top>] [dir]");
  process.exit(2);
}

const root = positionals[0] ?? ".";
const started = performance.now();

let paths: string[];
try {
  paths = await findFiles(root);
} catch (error) {
  console.error(`indexer: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const { index, errors } = await buildIndex(paths, { concurrency: jobs });

const totals = index.files.reduce(
  (t, f) => ({ bytes: t.bytes + f.bytes, lines: t.lines + f.lines, words: t.words + f.words }),
  { bytes: 0, lines: 0, words: 0 },
);

console.log(`Indexed ${index.files.length} files: ${totals.lines} lines, ${totals.words} words, ${totals.bytes} bytes`);
console.log(`\nTop ${top} terms:`);
for (const [term, n] of topTerms(index, top)) {
  console.log(`  ${String(n).padStart(6)}  ${term}`);
}
for (const e of errors) console.error(`error: ${e.path}: ${e.error}`);

// Timing goes to stderr so stdout stays identical across runs and thread counts.
console.error(`(${jobs} threads, ${Math.round(performance.now() - started)} ms)`);
process.exit(errors.length > 0 ? 1 : 0);
```

Notice `util.parseArgs` doing the flag parsing without a dependency, validation with exit code `2`, and timing written to stderr so stdout stays deterministic.

## Step 5: tests

The tests mirror the architecture: pure unit tests first, then integration tests against **real worker threads**.

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { buildIndex, findFiles } from "./builder.js";
import { indexText, mergeIndexes, tokenize, topTerms } from "./model.js";

describe("model", () => {
  it("tokenizes into lowercase words", () => {
    assert.deepEqual(tokenize("Hello, World! Don't stop."), ["hello", "world", "don't", "stop"]);
  });

  it("counts lines, words, bytes and terms", () => {
    const { stats, terms } = indexText("a.txt", "the cat\nthe hat\n");
    assert.deepEqual(stats, { path: "a.txt", bytes: 16, lines: 2, words: 4 });
    assert.deepEqual({ ...terms }, { the: 2, cat: 1, hat: 1 });
  });

  it("merges in any order to the same result", () => {
    const a = indexText("a.txt", "x y x");
    const b = indexText("b.txt", "y z");
    const one = mergeIndexes([a, b]);
    const two = mergeIndexes([b, a]);
    assert.deepEqual(one.files, two.files);
    assert.deepEqual(topTerms(one, 3), topTerms(two, 3));
    assert.deepEqual(topTerms(one, 3), [["x", 2], ["y", 2], ["z", 1]]);
  });
});

describe("buildIndex", () => {
  let dir: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "indexer-"));
    await mkdir(join(dir, "nested"));
    for (let i = 0; i < 20; i++) {
      const folder = i % 2 === 0 ? dir : join(dir, "nested");
      await writeFile(join(folder, `f${i}.txt`), `alpha beta ${"gamma ".repeat(i)}\nline two\n`);
    }
    await writeFile(join(dir, "ignored.bin"), "alpha");
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("only finds text files", async () => {
    assert.equal((await findFiles(dir)).length, 20);
  });

  it("gives identical output at any concurrency", async () => {
    const paths = await findFiles(dir);
    const one = await buildIndex(paths, { concurrency: 1 });
    const many = await buildIndex(paths, { concurrency: 6 });

    assert.deepEqual(one.index.files, many.index.files);
    assert.deepEqual(topTerms(one.index, 5), topTerms(many.index, 5));
    assert.equal(one.index.terms.get("alpha"), 20);
    assert.equal(one.index.terms.get("gamma"), (19 * 20) / 2);
    assert.deepEqual(one.errors, []);
  });

  it("reports unreadable files instead of failing the whole run", async () => {
    const result = await buildIndex([join(dir, "missing.txt"), join(dir, "f0.txt")]);
    assert.equal(result.errors.length, 1);
    assert.equal(result.index.files.length, 1);
  });

  it("handles an empty file list", async () => {
    const result = await buildIndex([]);
    assert.equal(result.index.files.length, 0);
  });
});
```

The test that matters most is "gives identical output at any concurrency": it builds the index with 1 thread and with 6 and asserts that the file list and top terms are equal. Concurrency bugs are exactly the kind that unit tests on single-threaded code never reveal, so this property — *the answer does not depend on scheduling* — is the one to lock down.

Run everything:

```bash
npm test
node dist/main.js -j 1 docs > one.txt
node dist/main.js -j 8 docs > eight.txt
diff one.txt eight.txt && echo identical
```

## Self-check

You are done when:

- `npm test` passes and `tsc` reports **zero** errors under the strict settings
- stdout is identical at `-j 1`, `-j 2` and `-j 8` on a directory with a few hundred files
- an unreadable file produces an error line and exit code `1`, not a crash
- the process exits promptly (no lingering idle workers)
- you can explain why `FileIndex.terms` is a `Record` and `Index.terms` is a `Map`
- **you have measured** a speedup: record wall-clock time at `-j 1` and `-j 4` on a large tree, and explain the gap between the ideal 4× and what you saw

## Stretch goals

1. **Streaming input.** Replace `readFile` with a stream so a multi-gigabyte file doesn't exhaust memory; count lines and words chunk by chunk and handle words that straddle chunk boundaries.
2. **Cancellation.** Support Ctrl+C: terminate the pool, print what was indexed so far, and exit with code `130`.
3. **Persistent cache.** Store each file's `FileIndex` keyed by path + mtime + size, and skip unchanged files on the next run. Measure the second-run speedup.
4. **Backpressure on the walk.** `findFiles` collects every path before work starts; turn it into an async generator that feeds the pool as it discovers files.
5. **SharedArrayBuffer progress counter.** Show a live "files done" counter updated by workers with `Atomics.add`.
6. **Search mode.** Build an inverted index (term → files + counts) and add `indexer search <term> <dir>`.
7. **Benchmark harness.** Use the `bench` helper from the performance lesson to compare pool sizes and report a table.
8. **Swap the pool for Piscina** and compare code size and behaviour.

## Recap

- You built a worker pool that never creates a thread per task and keeps every core busy through a shared queue.
- You made a concurrent program **deterministic** by making the merge order-independent and by sorting.
- You typed the thread boundary with a discriminated-union protocol and kept errors as data.
- You separated pure logic, concurrency mechanics and I/O, which is what made the tests simple.

That completes the course. You have gone from `console.log` to a tested, parallel, strictly typed Node tool. The best next step is to stop reading and build something you actually want to exist.

Back to the [course overview](../index.md).
