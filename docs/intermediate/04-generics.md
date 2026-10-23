# 4. Generics

## What & why

Some code works the same way for any type: reversing a list, wrapping a value, caching results. Without generics you'd either duplicate it per type or write `any` and lose safety. A **generic** is a function or type with a **type parameter** — a placeholder filled in at each use, with the relationships between types preserved.

## The problem

```ts
function firstAny(items: any[]): any {
  return items[0];
}
const n = firstAny([1, 2, 3]);    // any — the compiler has forgotten it's a number
n.toUpperCase();                   // compiles, crashes
```

## Generic functions

```ts
function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

const a = first([1, 2, 3]);        // number | undefined
const b = first(["x", "y"]);       // string | undefined
const c = first<boolean>([]);      // explicit: boolean | undefined
```

`<T>` declares a type parameter. TypeScript **infers** `T` from the arguments, so you rarely write it explicitly. Read `<T>(items: T[]): T` as "whatever type goes in, that same type comes out."

Several parameters:

```ts
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}
const p = pair("age", 36);          // [string, number]
```

## Constraints with `extends`

An unconstrained `T` is *anything*, so you can do almost nothing with it. Constrain it to demand capabilities:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest("hello", "hi");            // string
longest([1, 2, 3], [4]);           // number[]
// longest(10, 20);                // ERROR: number has no 'length'
```

The return type is `T`, not `{ length: number }`, so callers get their precise type back.

## `keyof` and indexed access

`keyof T` is the union of a type's keys. With a constraint it makes type-safe property access:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Ada", age: 36 };
getProp(user, "name");              // string
getProp(user, "age");               // number
// getProp(user, "email");          // ERROR: not assignable to "name" | "age"
```

`T[K]` is an **indexed access type**: "the type of property K on T".

## Generic types and interfaces

```ts
interface Box<T> {
  value: T;
}
const nb: Box<number> = { value: 1 };

type Maybe<T> = T | undefined;
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

interface Repository<T extends { id: number }> {
  get(id: number): T | undefined;
  save(item: T): void;
}
```

## Generic classes

```ts
class Stack<T> {
  #items: T[] = [];

  push(item: T): void {
    this.#items.push(item);
  }
  pop(): T | undefined {
    return this.#items.pop();
  }
  get size(): number {
    return this.#items.length;
  }
}

const s = new Stack<string>();
s.push("a");
// s.push(1);                       // ERROR: number is not assignable to string
```

## Default type parameters

```ts
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
const r: Result<number> = { ok: true, value: 1 };    // E defaults to Error
```

## Generic functions that take functions

This is where generics earn their keep — transformations whose types flow through:

```ts
function mapArray<T, U>(items: readonly T[], fn: (item: T) => U): U[] {
  const out: U[] = [];
  for (const item of items) out.push(fn(item));
  return out;
}

mapArray([1, 2, 3], (n) => String(n));     // string[]
mapArray(["a", "bb"], (s) => s.length);    // number[]
```

`T` is inferred from the array, `U` from what the callback returns.

```ts
function groupBy<T, K extends PropertyKey>(items: readonly T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    (out[key(item)] ??= []).push(item);
  }
  return out;
}

groupBy(["apple", "avocado", "banana"], (w) => w[0]!);
// Record<string, string[]>
```

## Generic constraints that reference each other

```ts
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
merge({ a: 1 }, { b: "x" });         // { a: number } & { b: string }
```

## A rule of thumb: use each type parameter at least twice

If `T` appears only once in a signature, it isn't relating anything and can be replaced with its constraint:

```ts
function printLength<T extends { length: number }>(x: T): void {}     // T used once: pointless
function printLength2(x: { length: number }): void {}                  // simpler, same meaning
```

## Inference and `const` type parameters

By default a literal argument widens (`"a"` becomes `string`). A `const` type parameter keeps it narrow:

```ts
function tuple<const T extends readonly unknown[]>(...items: T): T {
  return items;
}
const t = tuple("a", 1, true);       // readonly ["a", 1, true]
```

## When not to use generics

- If the function only works for one type, don't invent a type parameter.
- If you need `as` casts everywhere inside the body, the generic signature may be promising more than the body can deliver. Overloads or a simpler signature can be honest alternatives.
- Don't chase maximum generality; solve the problem in front of you.

## Common mistakes

- **`<T>` used once.** It adds noise without relating anything.
- **Forgetting constraints,** then fighting "property does not exist on type 'T'".
- **Using `any` inside a generic function** to make it compile, silently voiding the type safety you advertised.
- **Specifying type arguments by hand** when inference would do.
- **Misplacing the arrow-function generic in `.tsx`** files (`<T,>(x: T) => x` avoids the JSX ambiguity).
- **Confusing `T[]` and `T`** when passing arrays through.

## Exercises

1. Write `last<T>(items: readonly T[]): T | undefined`.
2. Write `uniqueBy<T, K>(items: T[], key: (t: T) => K): T[]` keeping the first of each key.
3. Write `pluck<T, K extends keyof T>(items: T[], key: K): T[K][]` and test with objects.
4. Implement `Queue<T>` with `enqueue`, `dequeue`, `size`.
5. Write `memoize<A, R>(fn: (arg: A) => R): (arg: A) => R` using a `Map<A, R>`.
6. Make `Result<T, E>` generic and write `mapResult` that transforms the success value and leaves failures untouched.
7. Find a function of yours with a generic `<T>` used once and simplify it.

## Recap

- A type parameter links input types to output types; inference usually fills it in.
- `extends` constrains what a type parameter must support.
- `keyof T` and `T[K]` give type-safe property access.
- Generic types, interfaces and classes work like generic functions; defaults reduce noise.
- Use generics when they relate types, not just because you can.

Next: [Utility types →](05-utility-types.md)
