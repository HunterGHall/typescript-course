# 1. Interfaces & type aliases

## What & why

Beginner code used inline object types like `{ name: string; age: number }`. Real programs name their shapes so they can be reused, extended and documented. TypeScript gives you two tools: `interface` and `type`. They overlap heavily; knowing where they differ lets you choose with confidence.

## Interfaces

```ts
interface User {
  readonly id: number;        // can't be reassigned
  name: string;
  email?: string;             // optional: string | undefined
}

const ada: User = { id: 1, name: "Ada" };
```

An interface describes a shape. Any value with at least those properties is a `User`: TypeScript is **structurally typed** ("if it walks like a duck..."), not nominally typed. You never write "implements" for plain data:

```ts
function greet(user: { name: string }): string {
  return `Hi ${user.name}`;
}
greet(ada);                       // fine: ada has a name
```

### Methods

```ts
interface Logger {
  log(message: string): void;            // method syntax
  level: "info" | "error";
  format?: (message: string) => string;  // optional function property
}
```

### Extending

```ts
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

interface Pet extends Dog, Logger {}     // extend several
```

### Declaration merging

Declaring the same interface twice **merges** them:

```ts
interface Settings { theme: string }
interface Settings { fontSize: number }
// Settings is now { theme: string; fontSize: number }
```

This is how libraries let you add to their types (for example, adding fields to Express's `Request`). Most application code never needs it.

## Type aliases

`type` names *any* type, not just objects:

```ts
type ID = string | number;                         // union
type Point = { x: number; y: number };             // object shape
type Callback = (error: Error | null) => void;     // function type
type Pair<T> = [T, T];                             // tuple
type Status = "idle" | "loading" | "done";         // literal union
```

Combine with **intersection** `&` (all members at once):

```ts
type Timestamped = { createdAt: Date };
type Post = { title: string } & Timestamped;       // both sets of properties
```

## `interface` or `type`?

| | `interface` | `type` |
| --- | --- | --- |
| Object shapes | yes | yes |
| Unions, tuples, primitives, mapped/conditional types | no | **yes** |
| `extends` | yes | via `&` |
| Declaration merging | yes | no |
| Error messages for deep extension | usually clearer | similar |
| Can be `implements`-ed by a class | yes | yes (if object-shaped) |

A practical rule:

- **Object shape someone might extend or implement → `interface`.**
- **Anything else (unions, function types, computed types) → `type`.**
- Pick one convention for object shapes per codebase and stay consistent.

## Excess property checks

Object *literals* assigned directly are checked for unknown properties:

```ts
const u: User = { id: 1, name: "Ada", admin: true };
// ERROR: Object literal may only specify known properties, and 'admin' does not exist in type 'User'

const data = { id: 1, name: "Ada", admin: true };
const ok: User = data;      // allowed: not a fresh literal
```

The check catches typos like `emial`. It does not apply to variables, because extra properties are harmless to a function that only reads the ones it needs.

## Index signatures

For objects used as dictionaries:

```ts
interface Scores {
  [player: string]: number;
}

const s: Scores = { ada: 10 };
s["bob"] = 7;
```

`Record<string, number>` means the same thing. If some keys are special, the special ones must fit the index signature type:

```ts
interface Config {
  [key: string]: string | number;
  name: string;               // OK: string fits
}
```

With `noUncheckedIndexedAccess`, `s["zed"]` is `number | undefined`.

## `readonly` and immutability

```ts
interface Point { readonly x: number; readonly y: number }
const p: Point = { x: 1, y: 2 };
// p.x = 5;            // ERROR
```

`readonly` is compile-time only and shallow. `Readonly<T>` makes all properties readonly (lesson 5); `ReadonlyArray<T>` / `readonly T[]` does the same for arrays.

## Describing functions and constructors

```ts
interface Comparator<T> {
  (a: T, b: T): number;             // call signature
}

interface UserFactory {
  new (name: string): User;         // construct signature
}

interface Counter {
  (): number;                       // callable...
  reset(): void;                    // ...with a property
}
```

## `satisfies`: check without widening

An annotation replaces the inferred type; `satisfies` *checks* the value against a type while keeping the precise inferred type:

```ts
type Colors = Record<string, string | [number, number, number]>;

const palette = {
  red: [255, 0, 0],
  green: "#00ff00",
} satisfies Colors;

palette.red.map((n) => n / 255);   // still known to be a tuple
palette.green.toUpperCase();       // still known to be a string
```

With `const palette: Colors = ...` both properties would be `string | [number, number, number]` and the calls above would fail.

## Optional vs `| undefined`

`{ email?: string }` allows the property to be **missing**. `{ email: string | undefined }` requires it to be **present** (but maybe undefined). With `exactOptionalPropertyTypes` on, the first also forbids explicitly writing `email: undefined`. Use `?` for "may be omitted".

## Common mistakes

- **Using `interface` for a union** (impossible) or `type` where you wanted merging.
- **Declaring the same interface twice by accident** and silently merging.
- **Leaning on excess property checks** as validation: they only apply to fresh object literals and not at runtime.
- **Thinking `readonly` protects at runtime.** It doesn't; use `Object.freeze` if you need that.
- **Using `Object` or `{}` as a type.** They mean "almost anything non-nullish". Use `object`, `Record<string, unknown>`, or a real shape.
- **Over-using index signatures** for known keys. List them.

## Exercises

1. Define `interface Shape` with a `name`, then `Circle` and `Rectangle` extending it with their own fields. Write a function accepting any `Shape`.
2. Define `type Result = { ok: true; value: number } | { ok: false; error: string }` and write a function that returns it.
3. Write a `Comparator<T>` interface and a `sortBy` function that accepts one.
4. Make a typo in an object literal property name and read the excess-property error; then assign through an intermediate variable and see why it passes.
5. Use `satisfies` on a config object with route handlers and show that autocomplete still works on the keys.
6. Decide `interface` vs `type` for: a union of three shapes, a function signature, and a class's public contract. Justify each.

## Recap

- `interface` and `type` both describe shapes; `type` additionally names unions, tuples and computed types.
- Typing is structural; extra properties only matter on fresh object literals.
- Extend interfaces with `extends`, combine types with `&`.
- Index signatures model dictionaries; `readonly` is shallow and compile-time.
- `satisfies` validates a value against a type without losing its precise type.

Next: [Classes →](02-classes.md)
