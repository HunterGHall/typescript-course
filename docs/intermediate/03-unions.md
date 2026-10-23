# 3. Unions & discriminated unions

## What & why

A **union** type says a value is *one of several* types. Combined with narrowing, unions let you model "this or that" precisely and make **invalid states unrepresentable** — the most powerful design technique TypeScript offers.

## Union basics

```ts
type Id = string | number;

function show(id: Id): string {
  if (typeof id === "string") {
    return id.toUpperCase();    // id: string
  }
  return id.toFixed(0);          // id: number
}
```

You may only use operations valid for **every** member until you narrow:

```ts
function len(x: string | string[]): number {
  return x.length;               // OK: both have .length
}
```

## Intersections

`A & B` is a value that is both:

```ts
type Named = { name: string };
type Aged = { age: number };
type Person = Named & Aged;      // { name: string; age: number }
```

Intersect objects to *combine* shapes; union to *choose* between them.

## The problem: boolean soup

```ts
interface LoadState {
  loading: boolean;
  data?: string;
  error?: Error;
}
```

Nothing stops `{ loading: true, data: "x", error: new Error() }` — an impossible state — and every consumer must guess which fields to trust.

## Discriminated unions

Give each variant a common **literal-typed tag** (the discriminant):

```ts
type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: string }
  | { status: "failure"; error: Error };

function render(req: LoadState): string {
  switch (req.status) {
    case "idle":
      return "Waiting";
    case "loading":
      return "Loading...";
    case "success":
      return `Got ${req.data.length} chars`;   // req: the success variant
    case "failure":
      return `Failed: ${req.error.message}`;   // req: the failure variant
  }
}
```

Checking `status` narrows the whole object. `data` exists only on `success`; asking for it elsewhere is a compile error. Impossible states cannot be written down.

## Exhaustiveness checking

Make the compiler tell you when a new variant is unhandled. In the `default`, assign to `never`:

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}

function render2(req: LoadState): string {
  switch (req.status) {
    case "idle": return "Waiting";
    case "loading": return "Loading...";
    case "success": return req.data;
    case "failure": return req.error.message;
    default: return assertNever(req);
  }
}
```

Add `{ status: "cancelled" }` to the union and `assertNever(req)` fails to compile: *Argument of type '{ status: "cancelled" }' is not assignable to parameter of type 'never'*. Every `switch` over the union now announces itself as needing an update. (With a `switch` that returns in every case and no `default`, `noImplicitReturns` gives a similar guarantee.)

## Modelling a domain

```ts
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2;
    case "rect": return s.width * s.height;
    case "triangle": return (s.base * s.height) / 2;
  }
}
```

Compare with a class hierarchy: here adding a new *operation* (`perimeter`) means writing one new function; adding a new *variant* means updating every switch (and the compiler lists them). Both approaches are valid; unions suit data, classes suit behaviour that varies.

## `Result` and `Option` shapes

A union can encode success or failure *in the type*:

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parsePort(text: string): Result<number, string> {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 && n < 65536
    ? { ok: true, value: n }
    : { ok: false, error: `bad port: ${text}` };
}

const r = parsePort("8080");
if (r.ok) console.log(r.value);       // number
else console.log(r.error);            // string
```

Lesson 8 compares this with exceptions.

## Narrowing tools for unions

```ts
typeof x === "string"              // primitives
x instanceof Date                  // classes
"swim" in animal                   // property presence
Array.isArray(x)                   // arrays
x.kind === "circle"                // discriminant
x !== undefined                    // absence
isFish(pet)                        // user-defined guard: (pet): pet is Fish
```

Narrowing also flows through assignments, early returns and `throw`.

## `as const` and literal unions

`as const` keeps literals narrow and makes data `readonly`:

```ts
const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];          // "admin" | "editor" | "viewer"

const isRole = (s: string): s is Role => (ROLES as readonly string[]).includes(s);
```

One list drives both the runtime check and the type — no duplication to drift apart.

## Enums? Usually not.

TypeScript has `enum`, but a union of literals is simpler, has no runtime footprint, and works with Node's type stripping (which can't handle enums):

```ts
type Direction = "up" | "down" | "left" | "right";
```

Prefer unions of string literals; reach for `enum` only for interop with code that already uses it.

## Unions of functions and arrays

```ts
type Handler = ((e: Event) => void) | undefined;
let items: (string | number)[] = [];     // array of unions
let either: string[] | number[] = [];    // either an array of strings OR an array of numbers
```

The parentheses change the meaning. `string[] | number[]` can't be `.push`ed to freely.

## Common mistakes

- **Boolean flags** instead of a tagged union.
- **Optional fields that are secretly required together.** Split into variants.
- **Forgetting the discriminant must be a literal type.** `kind: string` narrows nothing.
- **Handling variants with `if` chains** and no exhaustiveness check.
- **Casting with `as`** instead of narrowing: you lose the compiler's help.
- **Confusing `A | B` with `A & B`** when describing objects.

## Exercises

1. Model a payment as `card` (number, expiry), `cash` (nothing), or `transfer` (iban). Write `describe(payment)`.
2. Add a fourth variant and watch `assertNever` flag every switch.
3. Replace `{ loading: boolean; data?: T; error?: Error }` with a discriminated union and rewrite a render function.
4. Write a generic-free `Result` helper `unwrap(r: Result<number>)` that throws on failure.
5. Derive a `Role` type from an `as const` array and write a validator function for strings from user input.
6. Write `area` and `perimeter` for `Shape`. How many places changed when you added `"square"`?

## Recap

- `A | B` = one of; `A & B` = both. Narrow before using member-specific operations.
- Discriminated unions use a literal tag so checks narrow the whole object.
- Exhaustiveness via `never` turns "forgot a case" into a compile error.
- Model states as variants so invalid combinations can't exist.
- Prefer literal unions (and `as const`) over `enum`.

Next: [Generics →](04-generics.md)
