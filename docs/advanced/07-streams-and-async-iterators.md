# 7. Streams & async iterators

## What & why

`readFile` loads an entire file into memory. For a 20 GB log, that's a crash. **Streams** process data in chunks as it flows, using constant memory and starting work before the input is finished. Closely related, **async iterators** give you `for await` — the modern, readable way to consume anything that produces values over time: streams, paginated APIs, event feeds, message queues.

## Iterators in one minute

An iterable produces values on demand. Generators make them easy to write:

```ts
function* countTo(n: number): Generator<number, void, undefined> {
  for (let i = 1; i <= n; i++) yield i;
}

for (const x of countTo(3)) console.log(x);   // 1 2 3
```

Values are computed **lazily**: nothing runs until the consumer asks. An **async** generator yields values that may arrive later:

```ts
import { setTimeout as sleep } from "node:timers/promises";

async function* ticker(count: number, ms: number): AsyncGenerator<number> {
  for (let i = 1; i <= count; i++) {
    await sleep(ms);
    yield i;
  }
}

for await (const tick of ticker(3, 500)) {
  console.log("tick", tick);                    // one every half second
}
```

`for await` waits for each value, processes it, then asks for the next — so a slow consumer naturally slows the producer. That is **backpressure** in its simplest form.

## Async iterator pipelines

Compose async generators like Unix pipes. Each stage is lazy:

```ts
async function* map<T, U>(source: AsyncIterable<T>, fn: (t: T) => U | Promise<U>): AsyncGenerator<U> {
  for await (const item of source) yield await fn(item);
}

async function* filter<T>(source: AsyncIterable<T>, pred: (t: T) => boolean): AsyncGenerator<T> {
  for await (const item of source) if (pred(item)) yield item;
}

async function* take<T>(source: AsyncIterable<T>, n: number): AsyncGenerator<T> {
  if (n <= 0) return;
  let i = 0;
  for await (const item of source) {
    yield item;
    if (++i >= n) return;                         // stops pulling; upstream is cleaned up
  }
}

const evens = filter(ticker(100, 10), (n) => n % 2 === 0);
for await (const n of take(evens, 3)) console.log(n);     // 2 4 6, then stops
```

Returning early (or `break` in a `for await`) calls the iterator's `return()`, giving generators a chance to run their `finally` blocks and release resources.

Newer runtimes are adding built-in helpers (`Iterator.prototype.map`, `.filter`, `.take`, `.toArray`) for synchronous iterators; async helpers are still arriving, so a small library like the above is useful.

## Reading a file line by line

```ts
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

async function countLines(path: string): Promise<number> {
  const rl = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  let n = 0;
  for await (const _line of rl) n++;              // one line in memory at a time
  return n;
}
```

Node's readable streams are themselves async iterable, so this idiom works for network sockets, HTTP bodies and child process output too:

```ts
for await (const chunk of createReadStream("big.bin")) {
  // chunk is a Buffer (or string if you set an encoding)
}
```

## Node streams

There are four kinds, all in `node:stream`:

| Kind | Role | Example |
| --- | --- | --- |
| `Readable` | source | `fs.createReadStream`, HTTP request body |
| `Writable` | sink | `fs.createWriteStream`, HTTP response |
| `Duplex` | both | TCP socket |
| `Transform` | read → modify → write | `zlib.createGzip()` |

Connect them with `pipeline`, which handles errors and cleanup — **never** rely on bare `.pipe()`:

```ts
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

await pipeline(
  createReadStream("access.log"),
  createGzip(),
  createWriteStream("access.log.gz"),
);
```

If any stage errors, `pipeline` destroys all of them and rejects. `.pipe()` leaks file descriptors on failure.

### Custom transforms from generators

`pipeline` accepts async generator functions as stages:

```ts
import { Readable } from "node:stream";

async function* upperCase(source: AsyncIterable<string>): AsyncGenerator<string> {
  for await (const chunk of source) yield chunk.toUpperCase();
}

await pipeline(
  createReadStream("in.txt", "utf8"),
  upperCase,
  createWriteStream("out.txt"),
);

const readable = Readable.from(ticker(3, 10));    // async iterator → Readable
```

### Object mode

Streams carry `Buffer`/`string` by default. `objectMode: true` carries arbitrary values:

```ts
import { Transform } from "node:stream";

const parseLine = new Transform({
  objectMode: true,
  transform(chunk: string, _enc, callback) {
    try {
      callback(null, JSON.parse(chunk));
    } catch (e) {
      callback(e as Error);
    }
  },
});
```

## Backpressure

A fast producer and slow consumer would fill memory with buffered data. Streams handle this with a **high-water mark** (default 64 KiB for byte streams, 16 objects): `writable.write()` returns `false` when the buffer is full, and the producer should wait for `'drain'`.

```ts
import { once } from "node:events";

async function writeMany(out: NodeJS.WritableStream, lines: Iterable<string>): Promise<void> {
  for (const line of lines) {
    if (!out.write(line + "\n")) await once(out, "drain");    // wait for the buffer to empty
  }
}
```

`pipeline` and `for await` do this for you. Backpressure handling is the main reason to prefer them over hand-wired events. Ignoring it is how a "streaming" service ends up holding an entire file in RAM anyway.

## Web Streams

Node also implements the browser's **Web Streams** API (`ReadableStream`, `WritableStream`, `TransformStream`), used by `fetch`:

```ts
const response = await fetch("https://example.com/big.json");
const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(value.length);
}

for await (const chunk of response.body!) { /* Uint8Array chunks */ }
```

Convert between the two worlds with `Readable.fromWeb(...)`, `Readable.toWeb(...)`. Use Web Streams in code that must run in browsers, Deno, Bun and Node; use Node streams for fs, sockets and legacy libraries.

## Paginated APIs as async iterators

```ts
interface Page<T> { items: T[]; next?: string }

async function* paginate<T>(fetchPage: (cursor?: string) => Promise<Page<T>>): AsyncGenerator<T> {
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    yield* page.items;
    cursor = page.next;
  } while (cursor !== undefined);
}

for await (const user of paginate(fetchUsers)) {
  if (user.disabled) break;                      // no more pages are fetched
}
```

The caller sees one flat sequence; fetching is lazy and stops when they stop.

## Combining streams with concurrency

`for await` is sequential. To process items concurrently with a bound, collect into batches or use a small helper:

```ts
async function* batches<T>(source: AsyncIterable<T>, size: number): AsyncGenerator<T[]> {
  let batch: T[] = [];
  for await (const item of source) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

for await (const group of batches(lines, 100)) {
  await Promise.all(group.map(processOne));      // 100 at a time
}
```

## Errors and cleanup

```ts
async function* withCleanup(): AsyncGenerator<number> {
  const handle = await open("data.txt");
  try {
    yield 1;
    yield 2;
  } finally {
    await handle.close();                        // runs on break, return and throw
  }
}
```

`finally` inside a generator makes cleanup automatic for every consumer.

## Common mistakes

- **Using `.pipe()`** instead of `pipeline` (leaks, swallowed errors).
- **Buffering a "stream" into an array** and defeating the purpose.
- **Ignoring `write()`'s return value** and exhausting memory.
- **Forgetting string vs Buffer chunks:** set `encoding` or decode multi-byte characters correctly (`StringDecoder`, `TextDecoderStream`), or you can split a character across chunks.
- **`for await` over an array of promises** expecting parallelism — it's sequential.
- **Not handling `'error'`** on a stream (unhandled `'error'` events crash the process).
- **Mixing up `for await` and `Promise.all`:** one is streaming, one is parallel.

## Exercises

1. Write `async function* lines(path)` that yields a file's lines, and use it to find the longest line.
2. Gzip a large file with `pipeline`; check memory use stays flat.
3. Write a `Transform` (or an async generator stage) that parses NDJSON lines and drops invalid ones.
4. Implement `merge(...sources)` that interleaves several async iterables as values arrive.
5. Write `chunk(size)` and `throttle(ms)` stages and chain them.
6. Build `paginate` against a fake API with 5 pages and show that `break` stops the fetching early.

## Recap

- Streams process data in chunks with constant memory; async iterators give them a friendly `for await` interface.
- Async generators are lazy producers; stages compose like pipes; `break`/`return` triggers cleanup.
- Use `stream/promises.pipeline` for wiring and error handling.
- Backpressure keeps fast producers from overwhelming slow consumers; `pipeline` and `for await` handle it for you.
- Web Streams exist for cross-runtime code; convert with `Readable.fromWeb`/`toWeb`.

Next: [Worker threads →](08-worker-threads.md)
