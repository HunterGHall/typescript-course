# 8. Worker threads

## What & why

The event loop (lesson 6) is great for I/O but runs your JavaScript on one core. For CPU-heavy work — parsing big files, image processing, hashing, compression, simulation — you need real parallelism. **Worker threads** (`node:worker_threads`) run JavaScript on additional OS threads, each with its **own** event loop and V8 heap. They communicate by passing messages (copied) or by sharing raw memory (explicitly).

Use workers for CPU-bound work. For I/O-bound work they add overhead and gain nothing: the event loop already overlaps waiting.

## A first worker

Workers load a **separate file**. With `tsc`, that means the compiled `.js` file.

`src/worker.ts`:

```ts
import { parentPort, workerData } from "node:worker_threads";

function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

const { n } = workerData as { n: number };
parentPort?.postMessage(fib(n));
```

`src/main.ts`:

```ts
import { Worker } from "node:worker_threads";

function fibInWorker(n: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.js", import.meta.url), { workerData: { n } });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`worker stopped with exit code ${code}`));
    });
  });
}

console.time("two in parallel");
const [a, b] = await Promise.all([fibInWorker(40), fibInWorker(40)]);
console.timeEnd("two in parallel");   // about the time of ONE fib(40) on a multi-core machine
console.log(a, b);
```

Two things to notice: the worker URL points at `worker.js` (the compiled output), and the main thread stays free — timers and I/O keep running while the workers compute.

## Message passing

`postMessage` uses the **structured clone** algorithm: the data is *copied*. It handles objects, arrays, `Map`, `Set`, `Date`, typed arrays, `bigint`, even cycles; it cannot clone functions, class instances' methods, DOM nodes or symbols.

```ts
// main
worker.postMessage({ type: "job", id: 7, payload: [1, 2, 3] });
worker.on("message", (msg: { id: number; result: number }) => { /* ... */ });

// worker
parentPort!.on("message", (msg: { type: "job"; id: number; payload: number[] }) => {
  parentPort!.postMessage({ id: msg.id, result: msg.payload.reduce((a, b) => a + b, 0) });
});
```

Define the message types in a shared module and use a discriminated union so both ends are checked:

```ts
// protocol.ts
export type Request = { type: "hash"; id: number; text: string } | { type: "stop" };
export type Response = { type: "hashed"; id: number; digest: string } | { type: "error"; id: number; message: string };
```

TypeScript can't verify that the worker file is the one at the other end of the wire, so keep the protocol types in one place and validate at the boundary if the worker is third-party.

### Copy cost and transferables

Cloning a 500 MB buffer to send it is slow. **Transfer** it instead: ownership moves, and the sender's copy becomes unusable (detached) — zero copying.

```ts
const buffer = new ArrayBuffer(100 * 1024 * 1024);
worker.postMessage({ buffer }, [buffer]);        // transfer list
console.log(buffer.byteLength);                  // 0 — it's now the worker's
```

Transferable: `ArrayBuffer`, `MessagePort`, `FileHandle`, and the Web Streams types.

## Sharing memory: `SharedArrayBuffer` and `Atomics`

A `SharedArrayBuffer` is memory visible to several threads *at once*. Now data races are possible, so you need atomic operations:

```ts
// main
const shared = new SharedArrayBuffer(4);
const counter = new Int32Array(shared);
const workers = Array.from({ length: 4 }, () => new Worker(new URL("./counter-worker.js", import.meta.url), { workerData: shared }));
```

```ts
// counter-worker.ts
import { workerData } from "node:worker_threads";

const counter = new Int32Array(workerData as SharedArrayBuffer);
for (let i = 0; i < 100_000; i++) {
  Atomics.add(counter, 0, 1);          // atomic: never loses an update
  // counter[0]++;                     // NOT atomic: read, add, write — updates get lost
}
```

`Atomics` also provides `load`, `store`, `compareExchange`, and `wait`/`notify` for blocking synchronisation (`Atomics.wait` is allowed only in workers). Shared memory is fast but hard: prefer message passing unless you've measured a need.

## Worker pools

Starting a worker costs tens of milliseconds and megabytes. Don't spawn one per task: create a **pool** of long-lived workers and feed them jobs. This is the pattern the indexer capstone uses:

```ts
import { Worker } from "node:worker_threads";

interface Job {
  data: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

class Pool {
  #idle: Worker[] = [];
  #queue: Job[] = [];
  #running = new Map<Worker, Job>();

  constructor(url: URL, size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(url);
      worker.on("message", (result) => this.#finish(worker, (job) => job.resolve(result)));
      worker.on("error", (error) => this.#finish(worker, (job) => job.reject(error)));
      this.#idle.push(worker);
    }
  }

  run<T>(data: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#queue.push({ data, resolve: resolve as (value: unknown) => void, reject });
      this.#dispatch();
    });
  }

  #dispatch(): void {
    while (this.#idle.length > 0 && this.#queue.length > 0) {
      const worker = this.#idle.pop()!;
      const job = this.#queue.shift()!;
      this.#running.set(worker, job);
      worker.postMessage(job.data);
    }
  }

  #finish(worker: Worker, settle: (job: Job) => void): void {
    const job = this.#running.get(worker);
    this.#running.delete(worker);
    if (job) settle(job);
    this.#idle.push(worker);
    this.#dispatch();
  }

  async close(): Promise<void> {
    await Promise.all([...this.#idle, ...this.#running.keys()].map((w) => w.terminate()));
  }
}
```

Production code should use a battle-tested pool such as **Piscina**, which adds task cancellation, queue limits, resource limits and TypeScript-friendly helpers. Writing one by hand once is the best way to understand what it does.

### Choosing the pool size

For CPU-bound work, `os.availableParallelism()` threads is the sensible ceiling: more just adds context switching. Leave a core for the main thread if it must stay responsive.

## Where results don't match: design for determinism

Workers finish in an unpredictable order. If output must be stable, **tag each job with its index** and reassemble in order (or sort by a key), exactly as `mapLimit` did in the async lesson and the capstone does. Never let scheduling decide the visible result.

## Errors, exits, and cleanup

- An uncaught exception in a worker emits `'error'` on the `Worker` object and terminates that worker. Handle it, or the main thread throws.
- `'exit'` fires with the exit code; `worker.terminate()` stops one abruptly.
- Always terminate or `unref()` workers when finished; an idle `Worker` keeps the process alive.
- Use `AbortSignal` to cancel work cooperatively: pass a "stop" message and have the worker check a flag periodically (a worker busy in a tight loop never sees messages!). For tight loops, poll a `SharedArrayBuffer` flag with `Atomics.load`.

## `worker_threads` vs `child_process` vs `cluster`

| | Isolation | Memory | Use for |
| --- | --- | --- | --- |
| `worker_threads` | thread, own V8 heap | can share `SharedArrayBuffer` | CPU-bound JS inside one app |
| `child_process` | separate OS process | none shared | running other programs, hard isolation |
| `cluster` | many processes sharing a port | none shared | scaling an HTTP server across cores |

## Testing workers

Keep the *work* in a pure function that the worker simply calls; unit-test that function directly without threads. Then write a few integration tests that exercise the real pool (as the capstone does), including: empty input, a failing job, and identical results at pool size 1 and N.

## Common mistakes

- **Using workers for I/O-bound tasks.**
- **Spawning a worker per task** instead of pooling.
- **Pointing `new Worker` at the `.ts` file** (or a path relative to the wrong directory); use `new URL("./x.js", import.meta.url)`.
- **Sending huge objects by copy** instead of transferring buffers.
- **Using `SharedArrayBuffer` without `Atomics`,** producing lost updates and heisenbugs.
- **Letting completion order leak into output.**
- **Forgetting to handle `'error'`** or to terminate idle workers.

## Exercises

1. Compute `fib(40)` four times sequentially, then with four workers; compare wall-clock time.
2. Add a `type` field to messages and write a typed protocol shared between main and worker.
3. Send a 100 MB `ArrayBuffer` by copy and by transfer; time both.
4. Demonstrate lost updates with `counter[0]++` on shared memory, then fix with `Atomics.add`.
5. Complete the `Pool` class: add a bound on queue length and a `close()` that waits for running jobs.
6. Run a job that loops forever and cancel it by `terminate()`; then redo it with a cooperative flag.
7. Process 1 000 small strings with a pool and check that results are in input order for any pool size.

## Recap

- Worker threads give true parallelism for CPU-bound JavaScript; each has its own event loop and heap.
- Messages are copied (structured clone); transfer `ArrayBuffer`s to avoid copying.
- `SharedArrayBuffer` + `Atomics` share memory safely but are hard — prefer messages.
- Pool long-lived workers; size the pool to the core count; order results explicitly.
- Handle `'error'` and `'exit'`, terminate idle workers, and test the work function without threads.

Next: [Performance & profiling →](09-performance.md)
