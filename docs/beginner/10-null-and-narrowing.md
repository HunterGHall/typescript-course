# 10. `null`, `undefined` & narrowing

## What & why

Some values legitimately might not exist: a lookup that finds nothing, an optional field, the first element of an empty array. JavaScript has two "nothing" values — `undefined` ("not set") and `null` ("deliberately empty") — and forgetting to handle them is the most common JavaScript crash: *"Cannot read properties of undefined"*.

With `strict` (specifically `strictNullChecks`), TypeScript makes absence part of the **type**. A `string` is always a string; a `string | undefined` might be nothing, and the compiler **forces you to check** before you use it. This is TypeScript's most valuable feature. Learn it well.

## Where absence appears

```ts
const names = ["Ada", "Grace"];
const first = names[0];                 // string | undefined (with noUncheckedIndexedAccess)
const found = names.find((n) => n.startsWith("Z"));   // string | undefined
const parsed = Number.parseInt("abc"); // NaN — a number, not undefined!

const ages: Record<string, number> = { ada: 36 };
const age = ages["zed"];                // number | undefined

function hello(name?: string) {         // name: string | undefined
  // name.toUpperCase();                // ERROR: 'name' is possibly 'undefined'
}
```

## Narrowing: checking teaches the compiler

After a check, the type is narrower inside the guarded block:

```ts
function shout(name: string | undefined): string {
  if (name === undefined) {
    return "HELLO, STRANGER";
  }
  return name.toUpperCase();           // name: string here
}
```

TypeScript understands many kinds of check:

```ts
// truthiness
if (name) { name.length; }             // beware: "" and 0 are falsy too

// typeof
if (typeof value === "number") { value.toFixed(); }

// equality
if (a === b) { /* both narrowed to the common type */ }

// "in" for object shapes
if ("radius" in shape) { shape.radius; }

// instanceof for classes
if (error instanceof Error) { error.message; }

// Array.isArray
if (Array.isArray(x)) { x.length; }
```

## Optional chaining `?.`

Stop at the first `null`/`undefined` and produce `undefined` instead of crashing:

```ts
interface User {
  name: string;
  address?: { city?: string };
}

const user: User = { name: "Ada" };

user.address?.city;                    // string | undefined
user.address?.city?.toUpperCase();     // chain as far as you like
names?.[0];                            // optional index access
callback?.();                          // optional call
```

## Nullish coalescing `??`

Supply a default only for `null`/`undefined` (not for `0`, `""`, or `false`):

```ts
const city = user.address?.city ?? "unknown";
const port = Number(process.env["PORT"] ?? 3000);
```

And its assignment form: `settings.theme ??= "light";` sets it only if currently nullish.

## Early return: the clean way to unwrap

```ts
function cityLength(user: User): number {
  const city = user.address?.city;
  if (city === undefined) return 0;
  return city.length;                  // city: string for the rest of the function
}
```

Return (or throw) at the top for the "nothing" cases; the happy path then reads flat.

## The non-null assertion `!` — last resort

```ts
const first = names[0]!;               // tell the compiler "trust me, it's defined"
```

`!` removes `undefined`/`null` from the type with **no runtime check**. If you're wrong, you crash later with an obscure error. Use it only when you can *prove* absence is impossible (for example, right after checking `names.length > 0`). Otherwise, narrow properly or throw a clear error:

```ts
function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}
const config = must(process.env["HOME"], "HOME is not set");
```

## Type guards you write yourself

A function whose return type is a **type predicate** narrows the argument for its callers:

```ts
function isString(value: unknown): value is string {
  return typeof value === "string";
}

const items: unknown[] = [1, "a", 2, "b"];
const strings = items.filter(isString);        // string[]
```

You can also use it to remove `undefined` from arrays:

```ts
const maybe = ["a", undefined, "b"];
const defined = maybe.filter((x): x is string => x !== undefined);   // string[]
```

(TypeScript 5.5+ infers that predicate for simple filters like this automatically.)

## `null` vs `undefined`

Pick `undefined` for "not provided / not found" and avoid `null` in your own APIs unless an external format (JSON, a database) uses it. Handle both with `value == null` (the one place where loose equality is idiomatic and means "null or undefined"), or with `??`/`?.`.

## Absence as a return type

Return `T | undefined` when "no result" is normal and expected (a search that may find nothing). If something went *wrong* and the caller should know why, throw an `Error` (next lesson).

```ts
function firstNegative(xs: number[]): number | undefined {
  return xs.find((x) => x < 0);
}
```

## Common mistakes

- **Using `!` to silence the compiler.** It silences the *warning*, not the bug.
- **`||` for defaults** when `0`/`""`/`false` are valid; use `??`.
- **Truthiness checks on numbers and strings:** `if (count)` is false when `count` is `0`.
- **Turning off `strictNullChecks`** because the errors are annoying. Those errors are the product.
- **Assuming `typeof null`** is `"null"`; it's `"object"` (a historical quirk). Check `=== null` first.
- **Forgetting that `parseInt`/`Number` return `NaN`, not `undefined`,** on failure.

## Exercises

1. Write `safeDivide(a: number, b: number): number | undefined` and call it, handling both cases.
2. Given `string[]`, write `longest(words)` returning `string | undefined`; call it on `[]`.
3. Using `?.` and `??`, read `config.server?.port` with a default of `8080`, where `config` has deeply optional fields.
4. Write a type guard `isNumberArray(x: unknown): x is number[]`.
5. Replace this crash-prone code with a safe version: `const el = items.find(...)!; el.run();`
6. Explain, one sentence each, when you'd use `if` + early return, `??`, `?.`, a type guard, and `!`.

## Recap

- With `strict`, `T | undefined` and `T` are different types; the compiler makes you handle absence.
- Narrow with `=== undefined`, `typeof`, `in`, `instanceof`, truthiness, and custom type guards.
- `?.` short-circuits; `??` defaults only on null/undefined.
- `!` is a runtime crash waiting to happen; use it only when `undefined` is provably impossible.
- Return `T | undefined` for normal absence; throw for failure with a reason.

Next: [Files & error handling →](11-files-and-error-handling.md)
