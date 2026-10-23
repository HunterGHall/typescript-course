# 6. The event loop & concurrency

## What & why

JavaScript runs your code on **one thread**. Yet Node serves thousands of connections and reads many files "at once". The trick is the **event loop**: a scheduler that runs one piece of code at a time, to completion, and hands slow I/O to the operating system. Knowing exactly how it orders work explains puzzling output, and — more importantly — tells you why a single heavy computation freezes everything and what to do about it.

## The pieces

- **Call stack:** the functions currently running. JavaScript executes only the top frame.
- **Task (macrotask) queues:** callbacks waiting for their turn — timers, I/O completions, `setImmediate`.
- **Microtask queue:** promise reactions (`.then`, `await` continuations) and `queueMicrotask` callbacks.
- **The loop:** when the stack is empty, take the next piece of work, run it to completion, repeat.

**Run-to-completion** is the key rule: nothing interrupts a running function. There are no data races between two pieces of JavaScript on the same thread, and also no way for a long loop to be preempted.

## Order of execution

Predict this output, then run it:

```ts
console.log("1: sync");

setTimeout(() => console.log("5: timeout"), 0);
setImmediate(() => console.log("6: immediate"));

Promise.resolve().then(() => console.log("3: promise"));
queueMicrotask(() => console.log("4: microtask"));
process.nextTick(() => console.log("2.5: nextTick"));

console.log("2: sync");
```

Typical result:

```
1: sync
2: sync
2.5: nextTick
3: promise
4: microtask
5: timeout
6: immediate
```

(`setTimeout(0)` vs `setImmediate` ordering from the *main module* isn't guaranteed; inside an I/O callback `setImmediate` always wins.) The ordering rules:

1. All synchronous code runs first.
2. Then `process.nextTick` callbacks (Node-specific, runs before promises).
3. Then **all** microtasks, including ones queued while draining. The microtask queue is emptied completely before anything else.
4. Then the loop moves on to the next phase: timers → pending callbacks → poll (I/O) → check (`setImmediate`) → close callbacks, with microtasks drained between callbacks.

## What `await` does

```ts
async function main() {
  console.log("a");
  await null;                  // yields: the rest runs as a microtask
  console.log("c");
}
main();
console.log("b");
// a, b, c
```

`await` splits a function into the part before and a continuation after. The continuation is queued as a microtask once the awaited promise settles. Synchronous code after the call to `main()` runs in between — that is the point where "other work" gets to happen.

## Starvation

Microtasks and `nextTick` always drain before I/O. A loop that keeps queuing microtasks starves everything else:

```ts
function spin(): void {
  queueMicrotask(spin);        // never lets the loop reach timers or I/O
}
```

Likewise, any long synchronous loop blocks timers, I/O, and every other request:

```ts
setTimeout(() => console.log("timer"), 10);
const end = Date.now() + 2000;
while (Date.now() < end) {}    // the timer fires ~2 s late
```

## Blocking the loop in a server

```ts
import { createServer } from "node:http";

createServer((req, res) => {
  if (req.url === "/hash") {
    let x = 0;
    for (let i = 0; i < 5e9; i++) x += i;      // 5 seconds of CPU
    res.end(String(x));
  } else {
    res.end("ok");                             // every request waits behind /hash
  }
}).listen(3000);
```

While one request computes, the server can't respond to any other. This is the single most important Node performance fact.

### How to detect it

Measure **event loop delay**:

```ts
import { monitorEventLoopDelay } from "node:perf_hooks";

const histogram = monitorEventLoopDelay({ resolution: 10 });
histogram.enable();

setInterval(() => {
  console.log(`p99 delay: ${(histogram.percentile(99) / 1e6).toFixed(1)} ms`);
  histogram.reset();
}, 5000);
```

Healthy servers show single-digit milliseconds. Spikes mean something is blocking.

## Cures for blocking work

1. **Make it asynchronous** — if the work is I/O, use the promise APIs (`fs/promises`, `fetch`), never the `*Sync` ones in a server.
2. **Yield in the middle** — split a big loop into chunks and give the loop a chance to run:

    ```ts
    import { setImmediate as yieldToLoop } from "node:timers/promises";

    async function sumBig(n: number): Promise<number> {
      let total = 0;
      for (let i = 0; i < n; i++) {
        total += i;
        if (i % 1e6 === 0) await yieldToLoop();   // let other work run
      }
      return total;
    }
    ```

    Use `setImmediate` (not `Promise.resolve()`) to yield: a microtask yield wouldn't let I/O run.
3. **Move it off-thread** — worker threads (lesson 8) or a child process. For real CPU-bound work, this is the answer.

## Timers

```ts
const t = setTimeout(() => console.log("later"), 100);
clearTimeout(t);

const i = setInterval(() => console.log("tick"), 1000);
clearInterval(i);
```

- A delay is a **minimum**, not a promise: it fires when the loop is free after that time.
- A pending timer keeps the process alive; call `t.unref()` for a background timer that shouldn't.
- `setInterval` can stack up if the callback is slow. A recursive `setTimeout` schedules the next run *after* the work finishes.

## I/O and the thread pool

Network I/O uses the OS's non-blocking mechanisms and costs no thread. File system operations, DNS lookups (`dns.lookup`), some crypto (`pbkdf2`, `scrypt`) and compression (`zlib`) run on libuv's **thread pool** — 4 threads by default (`UV_THREADPOOL_SIZE`). Your JavaScript is still single-threaded; the pool does the blocking system calls on your behalf. Five simultaneous `fs.readFile` calls will therefore queue one behind another.

## Concurrency vs parallelism

- **Concurrency:** many tasks in progress, interleaved. The event loop gives you this for I/O-bound work.
- **Parallelism:** tasks executing at the same instant on multiple cores. You get this only with worker threads, child processes, or the libuv pool.

`Promise.all([a(), b()])` is concurrent: if `a` and `b` are I/O it overlaps their waiting. If they're CPU-heavy JavaScript, it runs them one after the other.

## Error handling in the loop

An exception thrown in a callback with no `try`/`catch` is **uncaught**; a rejected promise nobody handles is an **unhandled rejection**. Both terminate Node by default:

```ts
process.on("unhandledRejection", (reason) => {
  console.error("unhandled rejection:", reason);
  process.exit(1);
});
process.on("uncaughtException", (error) => {
  console.error("uncaught:", error);
  process.exit(1);
});
```

Log and exit; the process is in an unknown state. Let a supervisor (systemd, Docker, Kubernetes) restart it.

## Graceful shutdown

```ts
const server = createServer(/* ... */).listen(3000);

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));    // stop accepting; finish in-flight requests
  setTimeout(() => process.exit(1), 10_000).unref();   // hard deadline
});
```

## Common mistakes

- **Assuming `async` means "runs in the background".** An `async` function runs synchronously until its first `await`.
- **CPU-heavy work on the main thread** in a server.
- **`*Sync` filesystem calls in request handlers.**
- **Starving I/O** with endless `nextTick`/microtask recursion.
- **Relying on `setTimeout(fn, 0)` ordering** versus `setImmediate`.
- **Believing a timeout is exact.**
- **No handler for `unhandledRejection`,** or "handling" it by continuing.

## Exercises

1. Write the ordering example, predict the output, run it, and explain each line.
2. Block the loop for 2 seconds with a `while` loop and measure how late a 10 ms timer fires.
3. Add `monitorEventLoopDelay` to a small HTTP server with a `/block` route; compare delay with and without it.
4. Rewrite a blocking loop so it yields every million iterations; measure the effect on a concurrent timer.
5. Show that `Promise.all` of two CPU-bound functions takes the sum of their times, not the max.
6. Implement a graceful shutdown for a server that finishes in-flight requests on `SIGTERM`.

## Recap

- One thread, one task at a time, run to completion.
- Order: sync → `nextTick` → microtasks (all) → timers/I/O/immediates.
- `await` yields via microtasks; the code after the call runs first.
- Blocking the loop blocks everything; detect it with event-loop-delay metrics.
- Fix blocking by using async APIs, yielding with `setImmediate`, or moving work to workers.

Next: [Streams & async iterators →](07-streams-and-async-iterators.md)
