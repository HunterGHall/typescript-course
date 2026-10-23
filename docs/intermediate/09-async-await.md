# 9. Promises & async/await

## What & why

Reading files, calling APIs and waiting on timers all take time. JavaScript doesn't block while waiting: it starts the operation, carries on, and picks up the result later. A **`Promise<T>`** represents a value of type `T` that will exist in the future (or an error). `async`/`await` is syntax that lets you write that waiting code as if it were sequential.

## Promises

```ts
const p: Promise<number> = new Promise((resolve, reject) => {
  setTimeout(() => resolve(42), 100);
});

p.then((n) => console.log(n))            // 42
  .catch((e) => console.error(e))
  .finally(() => console.log("done"));
```

A promise is **pending**, then **fulfilled** with a value or **rejected** with an error — once, permanently. Most of the time you consume promises returned by library functions rather than creating them.

Wrapping a callback API:

```ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

(Node also has `import { setTimeout as sleep } from "node:timers/promises"`.)

## `async` and `await`

```ts
import { readFile } from "node:fs/promises";

async function wordCount(path: string): Promise<number> {
  const text = await readFile(path, "utf8");      // pauses this function, not the program
  return text.split(/\s+/).filter(Boolean).length;
}

const n = await wordCount("notes.txt");           // top-level await in ES modules
```

Rules:

- An `async` function **always returns a Promise**. `return 5` gives `Promise<number>`.
- `await` unwraps a promise to its value (or throws if it rejected).
- You can only use `await` inside an `async` function or at the top level of an ES module.

Errors become ordinary exceptions:

```ts
try {
  await wordCount("missing.txt");
} catch (error) {
  console.error("failed:", error);
}
```

## Sequential vs parallel

Each `await` waits for the previous one to finish. If the operations are **independent**, that wastes time:

```ts
// Slow: one after another (≈ 300 ms if each takes 100 ms)
const a = await fetchThing(1);
const b = await fetchThing(2);
const c = await fetchThing(3);

// Fast: start all, then wait (≈ 100 ms)
const [a2, b2, c2] = await Promise.all([fetchThing(1), fetchThing(2), fetchThing(3)]);
```

`Promise.all` preserves tuple types: `a2`, `b2`, `c2` each have the right type.

For a list:

```ts
const results = await Promise.all(urls.map((u) => fetchThing(u)));
```

## The combinators

| | Resolves when | If one fails |
| --- | --- | --- |
| `Promise.all` | all fulfil | rejects immediately with that error |
| `Promise.allSettled` | all finish | never rejects; gives `{status, value\|reason}` per item |
| `Promise.race` | the first settles | adopts that outcome (fulfilled or rejected) |
| `Promise.any` | the first **fulfils** | ignores failures until all fail (`AggregateError`) |

```ts
const settled = await Promise.allSettled([a(), b()]);
for (const s of settled) {
  if (s.status === "fulfilled") console.log(s.value);
  else console.error(s.reason);
}
```

## Timeouts and cancellation

`Promise.race` can implement a timeout, but the losing operation keeps running. For real cancellation, use `AbortController`/`AbortSignal`, which many Node APIs accept:

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 2000);

try {
  const res = await fetch("https://example.com", { signal: controller.signal });
  console.log(res.status);
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    console.error("timed out");
  } else throw error;
} finally {
  clearTimeout(timer);
}

// or the shortcut:
await fetch("https://example.com", { signal: AbortSignal.timeout(2000) });
```

## Limiting concurrency

`Promise.all(thousandItems.map(...))` starts everything at once, which can exhaust file handles or hammer a server. Process in bounded batches or with a small worker pool:

```ts
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;                       // safe: JS is single-threaded between awaits
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
```

Results stay in input order, but at most `limit` calls run at once. This exact shape powers the indexer capstone's thread pool.

## `await` in loops

```ts
for (const file of files) {
  await processFile(file);              // sequential on purpose: order matters, or limit load
}

files.forEach(async (file) => {     // BUG: forEach ignores the returned promises
  await processFile(file);
});
console.log("done?");               // runs immediately, before any file is done
```

`forEach` does not wait. Use `for...of` with `await` (sequential) or `Promise.all(map(...))` (parallel).

## Floating promises

Calling an async function without `await` or handling the result creates a **floating promise**: if it rejects, you get an `unhandledRejection` that can crash the process.

```ts
saveToDisk();                       // forgot await: errors vanish or crash later
void saveToDisk().catch(log);       // intentional fire-and-forget, with handling
```

ESLint's `@typescript-eslint/no-floating-promises` rule catches this and is worth enabling.

## Typing async code

```ts
async function load(): Promise<string[]> {
  return ["a", "b"];                          // returning a plain value is fine
}

type Loaded = Awaited<ReturnType<typeof load>>;   // string[]

function retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  return fn().catch((error) =>
    attempts > 1 ? retry(fn, attempts - 1) : Promise.reject(error),
  );
}
```

Don't write `Promise<Promise<T>>`; promises flatten, and `await` always gives the inner value.

## The mental model

`await` doesn't make anything run in parallel or on another thread. It yields control so *other* JavaScript can run while the I/O happens elsewhere. CPU-heavy synchronous work still blocks everything; that's what worker threads (Advanced) are for. The event loop lesson explains the machinery.

## Common mistakes

- **Forgetting `await`** — you get a `Promise` object where you expected a value (TypeScript usually catches it by type).
- **Sequential awaits** on independent work.
- **`forEach` with `async`.**
- **Unbounded `Promise.all`** over huge lists.
- **`Promise.race` for timeouts** without aborting the loser.
- **Swallowing rejections** with an empty `.catch(() => {})`.
- **Marking functions `async` for no reason** (it forces a Promise return type).
- **`return await`** is rarely needed (it is useful inside `try` blocks, to catch the rejection there).

## Exercises

1. Write `sleep(ms)` yourself, then use it to print "tick" three times, 500 ms apart.
2. Read three files sequentially and then in parallel; time both with `console.time`.
3. Use `Promise.allSettled` to read five files (some missing) and print which succeeded.
4. Implement `timeout<T>(p: Promise<T>, ms: number): Promise<T>` that rejects with a `TimeoutError`.
5. Use `mapLimit` to "fetch" 20 items with a limit of 3 and log the maximum number running at once.
6. Reproduce the `forEach` bug, observe it, and fix it two ways.
7. Add retry with exponential backoff to an async function.

## Recap

- `Promise<T>` = a future `T` or error; `async` functions return promises; `await` unwraps them.
- Independent work → `Promise.all`; tolerate failure → `allSettled`; first wins → `race`/`any`.
- Cancel with `AbortSignal`; bound concurrency with a small pool.
- `forEach` doesn't await; floating promises hide errors.
- `await` yields to the event loop; it never makes CPU work parallel.

Next: [JSON & runtime validation →](10-json-and-validation.md)
