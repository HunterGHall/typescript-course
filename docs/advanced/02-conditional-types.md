# 2. Conditional types & `infer`

## What & why

Generics let a type depend on another type. **Conditional types** let it *branch*: "if `T` is a string, produce this; otherwise that." Combined with `infer` (pattern matching on types), they are how `ReturnType`, `Awaited`, `Parameters` and most of the standard utilities are built — and how you build your own.

## The conditional type

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<"hi">;      // true
type B = IsString<42>;        // false
```

The syntax mirrors the ternary: `T extends U ? X : Y`. "Extends" here means "is assignable to". The condition is evaluated when `T` becomes known (at each use site).

A practical example — an API whose return type depends on its input:

```ts
type Id<T> = T extends { id: infer I } ? I : never;

type U1 = Id<{ id: number; name: string }>;    // number
type U2 = Id<{ name: string }>;                // never
```

## Distribution over unions

When `T` is a *naked type parameter* (just `T`, not `T[]` or `[T]`) and you pass a union, the conditional is applied to **each member** and the results are unioned:

```ts
type ToArray<T> = T extends unknown ? T[] : never;

type R = ToArray<string | number>;      // string[] | number[]   (not (string | number)[])
```

This is how `Exclude` and `Extract` work:

```ts
type MyExclude<T, U> = T extends U ? never : T;
type X = MyExclude<"a" | "b" | "c", "a">;    // "b" | "c"
// distribution: ("a" extends "a" ? never : "a") | ("b" extends "a" ? ...) | ... = never | "b" | "c"
```

To **prevent** distribution, wrap both sides in a tuple:

```ts
type NoDist<T> = [T] extends [string] ? "all strings" : "something else";
type N1 = NoDist<string | number>;           // "something else"
type D1 = (string | number) extends string ? 1 : 2;   // 2 — not distributive: no type parameter
```

Also remember `never` as a naked parameter distributes over *zero* members, yielding `never`:

```ts
type IsNever<T> = [T] extends [never] ? true : false;    // the correct way to test for never
```

## `infer`: pattern matching on types

`infer X` declares a type variable *inside* the `extends` clause and captures whatever matches in that position:

```ts
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type E1 = ElementOf<string[]>;              // string
type E2 = ElementOf<readonly [1, 2]>;       // 1 | 2

type Resolved<T> = T extends Promise<infer V> ? V : T;
type P1 = Resolved<Promise<string>>;        // string
type P2 = Resolved<number>;                 // number

type FirstArg<F> = F extends (first: infer A, ...rest: any[]) => any ? A : never;
type F1 = FirstArg<(name: string, age: number) => void>;   // string
```

The standard utilities are one-liners:

```ts
type MyReturnType<F> = F extends (...args: any[]) => infer R ? R : never;
type MyParameters<F> = F extends (...args: infer P) => any ? P : never;
```

(`any` is acceptable here: it's the widest *pattern*, not a loophole in your own code.)

You can infer from many positions:

```ts
type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : undefined;
type L1 = Last<[1, 2, 3]>;                  // 3

type Rest<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];
type R1 = Rest<[1, 2, 3]>;                  // [2, 3]
```

With constraints on the inferred variable (TS 4.7+):

```ts
type FirstString<T> = T extends [infer S extends string, ...unknown[]] ? S : never;
type FS = FirstString<["a", 1]>;            // "a"
```

## Recursive conditional types

Types can call themselves, giving you loops:

```ts
type DeepReadonly<T> = T extends (infer E)[]
  ? readonly DeepReadonly<E>[]
  : T extends Function
    ? T
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

type Config = { server: { ports: number[] }; name: string };
type RC = DeepReadonly<Config>;
// { readonly server: { readonly ports: readonly number[] }; readonly name: string }
```

String parsing is a classic exercise:

```ts
type Split<S extends string, D extends string> =
  S extends `${infer Head}${D}${infer Tail}` ? [Head, ...Split<Tail, D>] : [S];

type Parts = Split<"a,b,c", ",">;           // ["a", "b", "c"]
```

Recursion depth is limited (about 1000 levels, fewer for non-tail-recursive forms). Prefer tail-recursive shapes with an accumulator for long inputs:

```ts
type Reverse<T extends unknown[], Acc extends unknown[] = []> =
  T extends [infer H, ...infer R] ? Reverse<R, [H, ...Acc]> : Acc;

type Rev = Reverse<[1, 2, 3]>;              // [3, 2, 1]
```

## Useful real-world recipes

### Required keys / optional keys

```ts
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>;

type Ex = RequiredKeys<{ a: 1; b?: 2 }>;    // "a"
```

### Functions-only keys

```ts
type FunctionKeys<T> = {
  [K in keyof T]-?: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];
```

### Unwrapping nested promises & arrays

```ts
type Flatten<T> = T extends readonly (infer E)[] ? Flatten<E> : T;
type FL = Flatten<number[][][]>;            // number
```

### Union to intersection (a famous trick)

```ts
type UnionToIntersection<U> =
  (U extends unknown ? (arg: U) => void : never) extends (arg: infer I) => void ? I : never;

type UI = UnionToIntersection<{ a: 1 } | { b: 2 }>;    // { a: 1 } & { b: 2 }
```

It relies on contravariance (lesson 4): inferring from a function's *parameter* position across a union produces an intersection.

## Conditional types in function signatures

A function can return different types depending on a type parameter:

```ts
declare function parse<T extends "number" | "string">(
  kind: T,
  input: string,
): T extends "number" ? number : string;

const n = parse("number", "5");     // number
const s = parse("string", "x");     // string
```

Be aware: inside the *implementation*, TypeScript can't relate the unresolved conditional to your return value, so you typically need an overload set or a cast at that single spot. **Overloads are often cleaner** than a conditional return type; use conditionals when the mapping must be computed for open-ended inputs.

## Debugging conditional types

- Break the type into named intermediate types and hover each.
- Test small inputs with `Expect<Equal<...>>` (lesson 1).
- Remember distribution when a union produces a surprising result; wrap in `[T]` to confirm.
- `T extends any ? ... : never` and `T extends unknown ? ...` are the idiom to *force* distribution.
- If you see `Type instantiation is excessively deep and possibly infinite`, restructure with an accumulator or reduce recursion depth.

## When to stop

Type-level programming is powerful and addictive. Cleverness has a cost: slow compiles, cryptic errors, and teammates who can't maintain it. A good rule: if a conditional type needs more than a few lines of explanation, ask whether a simpler design (overloads, a discriminated union, a plain interface) would serve the same callers.

## Common mistakes

- **Forgetting distribution** (or expecting it where the parameter isn't naked).
- **Testing `never` with `T extends never`;** use `[T] extends [never]`.
- **Using conditional types** where a plain generic constraint would do.
- **Unbounded recursion** that hits the depth limit.
- **Expecting the compiler to check your conditional return inside the implementation body.**
- **Writing types nobody can read.** Name intermediates and document with examples.

## Exercises

1. Write `IsAny<T>`, `IsUnion<T>` and `IsNever<T>`. (Hint for `IsAny`: `0 extends 1 & T`.)
2. Write `ElementType<T>` that unwraps arrays, sets and maps' values; return `never` for others.
3. Implement `MyReturnType`, `MyParameters` and `Awaited` from scratch and test them with `Expect<Equal<...>>`.
4. Write `Join<T extends string[], D extends string>` producing `"a-b-c"` from `["a","b","c"]`.
5. Write `DeepPartial<T>`.
6. Write `PromiseValues<T>` that maps `{ a: Promise<number>; b: string }` to `{ a: number; b: string }`.
7. Build `Last<T>` and `Length<T>` for tuples, then `Tail<T>` and `Init<T>`.

## Recap

- `T extends U ? X : Y` branches at the type level; "extends" means assignable.
- Over naked type parameters, conditionals distribute across unions; wrap in `[T]` to stop it.
- `infer` captures parts of a type by pattern matching; it powers `ReturnType`, `Awaited` and friends.
- Recursion gives type-level loops (watch the depth); use accumulators.
- Prefer simpler designs unless the computed type genuinely earns its complexity.

Next: [Mapped & template literal types →](03-mapped-and-template-types.md)
