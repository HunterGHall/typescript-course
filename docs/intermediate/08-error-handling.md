# 8. Errors in depth

## What & why

The Beginner level introduced `try`/`catch`. Real systems need more: errors that say *what kind* of failure occurred, that keep the original cause, that can be handled selectively, and a decision about when to throw versus return a value. This lesson builds that toolkit.

## Custom error classes

```ts
class AppError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;          // "AppError", or the subclass name
  }
}

class NotFoundError extends AppError {
  constructor(readonly resource: string, readonly id: string | number) {
    super(`${resource} ${id} not found`);
  }
}

class ValidationError extends AppError {
  constructor(message: string, readonly field: string) {
    super(message);
  }
}
```

Targeting ES2015 or later, `extends Error` works correctly, `instanceof` works, and the stack trace is preserved.

## Catching selectively

```ts
function handle(error: unknown): string {
  if (error instanceof NotFoundError) return `404: ${error.resource}`;
  if (error instanceof ValidationError) return `400: ${error.field}: ${error.message}`;
  throw error;                                    // not ours: let it propagate
}
```

Handle what you understand; rethrow the rest. A bare `catch {}` that swallows everything turns bugs into silence.

## Error `cause`

Wrap a low-level error with context, without losing the original:

```ts
import { readFile } from "node:fs/promises";

async function loadConfig(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new AppError(`Could not load config from ${path}`, { cause: error });
  }
}

try {
  await loadConfig("missing.json");
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message);       // Could not load config from missing.json
    console.error(e.cause);         // the original ENOENT error
  }
}
```

Each layer adds context ("what was I trying to do?") and the chain shows the root cause.

## Narrowing `unknown`

```ts
function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && "code" in e;
}

try {
  // ...
} catch (e) {
  if (isErrnoException(e) && e.code === "ENOENT") {
    // file not found
  }
}
```

Also `throw` can throw anything; if you catch something that isn't an `Error` (a library or old code that throws strings), wrap it: `new Error(String(e))`.

## Exceptions vs returned errors

| Throw an exception | Return a result (`Result`, `T \| undefined`) |
| --- | --- |
| A bug or truly unexpected failure | A normal, expected outcome (parse failed, not found) |
| The caller usually can't do anything useful | The caller must decide what to do |
| Deep call stacks where propagation is convenient | Performance-critical loops (throwing is slow) |

TypeScript does **not** track which functions throw, so a thrown error is invisible in the signature. When failure is part of a function's contract, encode it in the type:

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

function parseJson(text: string): Result<unknown, SyntaxError> {
  try {
    return ok(JSON.parse(text));
  } catch (e) {
    return err(e as SyntaxError);
  }
}

const r = parseJson("{bad");
if (!r.ok) {
  console.error(r.error.message);       // the compiler forced us to check
}
```

The caller *cannot* reach `r.value` without checking `r.ok`. That compile-time pressure is the point.

A sensible split: **exceptions for the unexpected, `Result` for the expected.**

## `finally` and resource cleanup

`finally` runs whether the `try` succeeded or threw:

```ts
import { open } from "node:fs/promises";

async function firstLine(path: string): Promise<string> {
  const handle = await open(path);
  try {
    for await (const line of handle.readLines()) return line;
    return "";
  } finally {
    await handle.close();               // always release the file
  }
}
```

Be careful: a `return` or `throw` inside `finally` overrides whatever happened in `try`.

### `using` (explicit resource management)

TypeScript 5.2+ supports `using`, which calls a disposer automatically when the scope ends:

```ts
function openTemp(): { path: string; [Symbol.dispose](): void } {
  const path = "/tmp/x";
  return { path, [Symbol.dispose]() { console.log("cleaned up", path); } };
}

{
  using tmp = openTemp();
  console.log("working with", tmp.path);
}                                        // "cleaned up /tmp/x" runs here
```

Use `await using` with `Symbol.asyncDispose` for async cleanup. You need `lib` entries for `esnext.disposable` (or a recent target) and a Node version that supports it (24+; older versions need a polyfill).

## Aggregating errors

Several operations can fail independently:

```ts
const results = await Promise.allSettled([a(), b(), c()]);
const failures = results.filter((r) => r.status === "rejected");
if (failures.length > 0) {
  throw new AggregateError(failures.map((f) => f.reason), "Some tasks failed");
}
```

## Assertions

Use `assert` for conditions that indicate programmer error, not user error:

```ts
import assert from "node:assert/strict";

function average(xs: number[]): number {
  assert(xs.length > 0, "average of empty list");
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
```

An assertion function also narrows types:

```ts
function assertDefined<T>(value: T | undefined, message: string): asserts value is T {
  if (value === undefined) throw new Error(message);
}
```

## At the edge: one place to report

Don't scatter `console.error` + `process.exit` through libraries. Let errors propagate to the entry point, then:

```ts
try {
  await main();
} catch (error) {
  console.error(error instanceof AppError ? error.message : error);
  process.exitCode = 1;                  // prefer exitCode to exit(): lets pending output flush
}
```

Also be aware of crashes from `unhandledRejection` and `uncaughtException`: log them and exit; don't try to continue in an unknown state.

## Common mistakes

- **Throwing strings or plain objects.**
- **Empty `catch` blocks.**
- **Losing the original error** when wrapping; pass `{ cause }`.
- **Exceptions for ordinary control flow** (e.g. throwing to signal "not found" in a hot loop).
- **Catching `unknown` and assuming `.message` exists.**
- **`return` in `finally`,** which silently discards errors.
- **Calling `process.exit()` deep in a library,** making it untestable and cutting off output.

## Exercises

1. Create `AppError`, `NotFoundError` and `ValidationError` and write a `handle` function that returns an HTTP-like status for each.
2. Wrap a failing `JSON.parse` in a custom error with `cause`; print the whole chain.
3. Write `tryAsync<T>(p: Promise<T>): Promise<Result<T>>` and use it without a `try`/`catch`.
4. Write `parsePort(text): Result<number, string>` and `parseHost(text): Result<string, string>`, then a function combining both that returns the first error.
5. Write an assertion function `assertNonEmpty(xs)` that narrows `T[]` to `[T, ...T[]]`.
6. Use `Promise.allSettled` over five operations (some failing) and report successes and failures separately.

## Recap

- Subclass `Error` for meaningful, catchable categories; set `name`, use `instanceof`.
- Always preserve the original with `{ cause }`; catch only what you can handle and rethrow the rest.
- TypeScript doesn't type thrown errors; use `Result` types for expected failures.
- `finally` / `using` guarantee cleanup; assertion functions narrow types.
- Report at the edge of the program, with one exit path.

Next: [Promises & async/await →](09-async-await.md)
