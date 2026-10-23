# 1. The type system as a language

## What & why

Up to now, types have described values. At this level it helps to see the type system as a **small programming language of its own**: it has values (types), operators (`|`, `&`, `keyof`), functions (generic types), conditionals and loops. Once you understand how it *reasons* — especially what "assignable" means — error messages stop being mysterious and advanced types become straightforward.

## Types are sets of values

A type is a set of values it permits:

- `string` — every string.
- `"a"` — a set with one member.
- `"a" | "b"` — the union (set union) of two such sets.
- `{ name: string }` — every object that has at least a `name` string (including ones with more properties).
- `never` — the **empty set**: no values at all.
- `unknown` — the **universal set**: every value.
- `any` — an escape hatch that opts out of the set model.

`A` is **assignable** to `B` when every value in `A` is also in `B` (A ⊆ B):

```ts
const a: "x" = "x";
const b: string = a;           // ok: {"x"} ⊆ string
// const c: "x" = b;            // error: string ⊄ {"x"}

let wide: { name: string } = { name: "Ada" };
const narrow = { name: "Ada", age: 36 };
wide = narrow;                 // ok: objects with more properties are a *subset* of the objects with fewer requirements
```

That last line surprises people at first: the *more specific* type (more properties) is the *smaller* set, so it's assignable to the less specific one.

## `never` and `unknown` as identities

Set algebra explains their roles:

```ts
type A = string | never;       // string      (union with the empty set changes nothing)
type B = string & unknown;     // string      (intersection with everything changes nothing)
type C = string & number;      // never       (no value is both)
type D = string | unknown;     // unknown     (absorbs everything)
type E = string & never;       // never
```

`never` is assignable to everything (the empty set is a subset of every set). That is why a function that throws can have any return type, and why `assertNever(x: never)` works as a proof that all cases were covered.

## Structural typing and its limits

TypeScript compares **shapes**, not names:

```ts
interface Meters { value: number }
interface Feet { value: number }
const m: Meters = { value: 1 };
const f: Feet = m;             // allowed — same shape
```

That's convenient and occasionally dangerous (mixing units). Lesson 4 shows **branding** to get nominal behaviour when you need it.

## Assignability rules worth knowing

**Objects:** the target's properties must exist in the source with assignable types. Extra properties are fine (except for fresh literals).

**Functions:** a function is assignable if it accepts *at least* what is required and returns *at least* what is promised.

```ts
type Handler = (event: MouseEvent) => void;
const general: (event: Event) => void = () => {};
const h: Handler = general;     // ok: a function that handles any Event can handle a MouseEvent

const fewerParams: Handler = () => {};   // ok: ignoring arguments is fine
// const moreParams: Handler = (e: MouseEvent, extra: number) => {};   // error: caller won't supply `extra`
```

Parameters are checked **contravariantly** (more general is OK), return types **covariantly** (more specific is OK). Lesson 4 covers variance fully.

**Unions:** `A | B` is assignable to `T` only if *both* `A` and `B` are. A value of type `A` is assignable to `A | B`.

**Literal widening:**

```ts
let x = "hello";               // string — `let` widens the literal
const y = "hello";             // "hello"
const obj = { mode: "fast" };  // { mode: string } — properties are mutable, so they widen
const obj2 = { mode: "fast" } as const;   // { readonly mode: "fast" }
```

Widening is why `{ mode: "fast" }` can't be passed where `{ mode: "fast" | "slow" }` is expected — unless you write `as const`, annotate, or use `satisfies`:

```ts
type Opts = { mode: "fast" | "slow" };
const opts = { mode: "fast" } satisfies Opts;     // keeps mode: "fast"
```

## `as const`: freeze a literal

```ts
const config = {
  env: "prod",
  ports: [80, 443],
} as const;
// { readonly env: "prod"; readonly ports: readonly [80, 443] }

type Port = (typeof config.ports)[number];        // 80 | 443
```

The single biggest source of "why can't it infer that?" is forgetting that literals widen by default.

## Narrowing is control-flow analysis

At every point in the code, the compiler tracks the *narrowest type it can prove*:

```ts
function f(x: string | number | undefined) {
  if (x === undefined) return;      // x: string | number
  if (typeof x === "string") {
    x;                              // string
  } else {
    x;                              // number
  }
  x;                                // string | number (branches merged)
}
```

It understands `typeof`, `instanceof`, `in`, equality, truthiness, discriminant properties, user-defined predicates (`x is T`) and assertion functions (`asserts x is T`). It **resets** when it can't track mutation, notably in callbacks:

```ts
let value: string | undefined = getValue();
if (value !== undefined) {
  setTimeout(() => value.length, 0);    // error on `let` — value might be reassigned before the callback runs
}
```

Use `const` (or copy to a `const`) to keep the narrowing.

## `any` vs `unknown` vs `never`, revisited

| | Assign *to* it | Use *from* it | Role |
| --- | --- | --- | --- |
| `any` | anything | anything (unchecked) | disables checking: viral |
| `unknown` | anything | nothing until narrowed | safe top type |
| `never` | nothing | assignable to anything | empty / unreachable |

Prefer `unknown` for "I don't know yet". `any` also spreads: a value derived from an `any` is `any`.

## Reading error messages

Long errors read bottom-up: the *last* line is usually the root cause.

```
Type '{ name: string; age: string; }' is not assignable to type 'User'.
  Types of property 'age' are incompatible.
    Type 'string' is not assignable to type 'number'.
```

The first line says what failed; the final line says why. Following the indentation is following the path into the nested type.

## Inspecting types

The Playground and your editor's hover show inferred types. For complex types, make the compiler print them by expanding:

```ts
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type Pretty = Expand<Partial<User> & { extra: 1 }>;   // hover shows a flat object
```

And test your types with compile-time assertions:

```ts
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type Expect<T extends true> = T;

type _t1 = Expect<Equal<Pick<{ a: 1; b: 2 }, "a">, { a: 1 }>>;     // passes
// type _t2 = Expect<Equal<string, number>>;                        // error: false doesn't satisfy true
```

This `Equal` trick is how type libraries test themselves.

## Soundness: where TypeScript is deliberately loose

TypeScript is not fully sound. Known holes you should recognise:

- **Array covariance:** `string[]` is assignable to `(string | number)[]`, which then allows pushing a number into the original.
- **Type assertions** (`as`) and `any`.
- **Index access** without `noUncheckedIndexedAccess`.
- **Method bivariance:** methods declared with method syntax are checked bivariantly.
- **`Object.keys`** returning `string[]`.

Understanding where the compiler *trusts you* tells you where to be careful.

## Common mistakes

- **Treating a type as a class** (types describe sets, classes create values).
- **Expecting `A | B` to allow members of either** without narrowing.
- **Forgetting widening** and being surprised by `string` where you wanted a literal.
- **Assuming `x as T` converts the value;** it only changes what the compiler believes.
- **Using `any` as "unknown but convenient".**
- **Reading the first line of a long error** and ignoring the last.

## Exercises

1. For each, say whether it's assignable and why: `"a"` → `string`; `string` → `"a"`; `{a: 1, b: 2}` → `{a: number}`; `(x: number) => void` → `(x: 1) => void`; `never` → `string`.
2. Predict the types of `string & number`, `"a" | string`, `{a: 1} & {a: 2}` (hint: the property becomes `never`).
3. Write `Expect<Equal<...>>` assertions for three utility types and one failing case you then comment out.
4. Demonstrate array covariance unsoundness with a short program.
5. Explain why `const x = { a: 1 }` can't be passed where `{ a: 1 }` is required, and fix it three ways.
6. Take a 5-line nested error message and annotate which line is the cause.

## Recap

- Types are sets; assignability is subset; `never` is empty, `unknown` is everything.
- Structural typing compares shapes; more-specific object types are subsets of less-specific ones.
- Literals widen unless frozen (`const`, `as const`, `satisfies`).
- Control-flow analysis narrows types and resets around mutation and callbacks.
- Know where TypeScript is intentionally unsound.

Next: [Conditional types & `infer` →](02-conditional-types.md)
