# 11. Testing

## What & why

The compiler proves that types line up. It cannot prove that `slugify("Hello, World!")` returns `"hello-world"`. **Tests** pin down behaviour so you can change code later without fear. Good tests are the reason you can refactor.

Node ships a test runner (`node:test`) and an assertion library (`node:assert`), so you need no extra dependencies. Popular alternatives — **Vitest** and **Jest** — follow the same ideas with a richer feature set and watch mode; everything here transfers.

## A first test

`src/slug.ts`:

```ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

`src/slug.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    assert.equal(slugify("Hello, World!"), "hello-world");
  });

  it("trims leading and trailing separators", () => {
    assert.equal(slugify("  --Hi--  "), "hi");
  });

  it("returns an empty string for punctuation only", () => {
    assert.equal(slugify("!!!"), "");
  });
});
```

Compile and run:

```bash
npx tsc
node --test "dist/**/*.test.js"
```

```
✔ slugify (2.1ms)
  ✔ lowercases and joins words with hyphens
  ✔ trims leading and trailing separators
  ✔ returns an empty string for punctuation only
```

Because the tests are TypeScript, the compiler also checks that you call your functions correctly. (With Node 22.18+/24 you can run `node --test src/` directly on `.ts` files, though this skips type-checking; keep `tsc` in your workflow.)

## Anatomy of a good test

Arrange → Act → Assert, one behaviour per test, with a name that reads as a sentence:

```ts
it("rejects negative deposits", () => {
  const account = new Account("A-1", 100);          // arrange
  const act = () => account.deposit(-5);            // act (deferred)
  assert.throws(act, RangeError);                   // assert
});
```

If a test fails, its name should tell you what broke without reading the body.

## Assertions you'll use

```ts
import assert from "node:assert/strict";

assert.equal(1 + 1, 2);                              // strict equality (===)
assert.notEqual(a, b);
assert.deepEqual({ a: [1, 2] }, { a: [1, 2] });      // structural equality (strict mode)
assert.ok(value);                                    // truthy
assert.match("hello", /ell/);
assert.throws(() => parse("x"), /invalid/);          // sync throw
await assert.rejects(loadUser(0), NotFoundError);    // async rejection
```

Import from `node:assert/strict` so `equal`/`deepEqual` use strict semantics.

## Testing pure functions is easy; design for it

The more logic you put in pure functions (data in, data out), the less you need setup, files or mocks. This is why the capstones separate a **pure library** from a **thin command-line wrapper**:

```
src/links.ts      # pure: text in, data out → trivial to test
src/checker.ts    # touches the filesystem → test with a temp directory
src/main.ts       # arguments + printing → barely tested, almost no logic
```

## Setup and teardown

```ts
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("loadNotes", () => {
  let dir: string;

  before(async () => {                                  // once, before all tests
    dir = await mkdtemp(join(tmpdir(), "notes-"));
  });
  after(() => rm(dir, { recursive: true, force: true })); // once, after all

  it("reads a file", async () => {
    await writeFile(join(dir, "a.txt"), "hello");
    // ...
  });
});
```

Use a fresh temporary directory per suite so tests don't touch your real files or each other.

## Async tests

Return a promise or use `async`:

```ts
it("loads a user", async () => {
  const user = await loadUser(1);
  assert.equal(user.name, "Ada");
});
```

Tests in a file run in order; tests across files run in parallel processes. Never rely on one test's side effects in another.

## Mocking and test doubles

Isolate the code under test by replacing its collaborators. The cleanest way is **dependency injection**: take collaborators as parameters.

```ts
interface Clock { now(): Date }

function greeting(clock: Clock): string {
  return clock.now().getHours() < 12 ? "Good morning" : "Good afternoon";
}

it("says good morning before noon", () => {
  const fake: Clock = { now: () => new Date("2026-01-01T09:00:00") };
  assert.equal(greeting(fake), "Good morning");
});
```

For when injection isn't possible, `node:test` has mocks:

```ts
import { mock } from "node:test";

const fn = mock.fn((n: number) => n * 2);
fn(2);
fn(3);
assert.equal(fn.mock.callCount(), 2);
assert.deepEqual(fn.mock.calls.map((c) => c.arguments), [[2], [3]]);

mock.timers.enable({ apis: ["setTimeout"] });         // fake time
```

Mock at **boundaries** (network, clock, filesystem); don't mock the code you're trying to test.

## Testing errors

```ts
it("throws on empty input", () => {
  assert.throws(() => average([]), { name: "Error", message: /empty/ });
});
```

Always test the unhappy paths: bad input, empty collections, boundaries (0, 1, max), and `undefined`.

## Testing types

Sometimes the *type* is the feature. Check that something does **not** compile with `// @ts-expect-error`, which itself errors if the line is *not* an error:

```ts
// @ts-expect-error: id must be a number
const bad: User = { id: "1", name: "Ada" };
```

If someone loosens `User` later, the test file stops compiling and tells you.

## Coverage

```bash
node --test --experimental-test-coverage "dist/**/*.test.js"
```

Coverage shows which lines never ran. It cannot show whether the assertions are *good*. Treat low coverage as a prompt to look, not high coverage as proof.

## Test design principles

- **Test behaviour, not implementation.** If a refactor that preserves behaviour breaks the test, the test was too tightly coupled.
- **One reason to fail.** Several asserts are fine if they describe one behaviour.
- **Deterministic.** No real time, randomness, network or shared state without control.
- **Fast.** A suite that takes seconds gets run constantly.
- **Readable.** Tests are documentation.

## Common mistakes

- **Testing the compiler** (e.g. that a `number` is a number).
- **Mocking everything** until the test only tests the mocks.
- **Shared mutable state** between tests that makes order matter.
- **Forgetting `await`** in an async test so it passes before the assertion runs (`assert.rejects` needs `await`).
- **Weak assertions:** `assert.ok(result)` when you can compare the exact value.
- **Tests that read the real home directory,** the network, or `Date.now()`.
- **Ignoring failing tests** by deleting them.

## Exercises

1. Write five tests for `slugify`, including an emoji, an empty string, and accented letters (decide the correct behaviour first).
2. Test `parsePort(text): Result<number, string>` for valid, zero, negative, too large, non-numeric and empty input.
3. Make a function depend on a `Clock` interface and test it with a fake at 6 am, noon and midnight.
4. Write a test using a temporary directory that creates files and checks your directory-scanning function.
5. Use `mock.fn` to verify that a retry helper calls its task the expected number of times.
6. Write one `@ts-expect-error` test that guards a type you care about.

## Recap

- `node:test` + `node:assert/strict` need no dependencies; compile with `tsc` and run `node --test`.
- Arrange / act / assert; one behaviour per test; name tests as sentences.
- Put logic in pure functions behind a thin CLI so it's easy to test.
- Inject dependencies; mock at boundaries only; use temporary directories for files.
- Test failure paths and boundaries, and use `@ts-expect-error` to test types.

Next: [Capstone: link checker →](12-capstone-link-checker.md)
