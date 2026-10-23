# 2. Variables & basic types

## What & why

A **variable** is a name for a value. A **type** describes what kind of value it can hold. TypeScript checks, before the program runs, that you only ever do things a value's type allows — no adding a number to a function, no calling `.toUpperCase()` on a number.

## `const` and `let`

```ts
const language = "TypeScript";   // cannot be reassigned
let score = 0;                   // can be reassigned
score = 10;

// language = "JavaScript";      // ERROR: Cannot assign to 'language' because it is a constant
```

Prefer `const`; reach for `let` only when the variable truly changes. Avoid `var` — it has confusing scoping rules and exists only for old code.

## The basic types

```ts
const age: number = 36;            // all numbers: integers and decimals
const name: string = "Ada";
const isAdmin: boolean = false;
const big: bigint = 12345678901234567890n;
const id: symbol = Symbol("id");
const nothing: null = null;
const missing: undefined = undefined;
```

The `: type` after a name is a **type annotation**.

## Type inference

You rarely need to write annotations on variables; TypeScript works the type out from the value:

```ts
const city = "Lisbon";         // type: "Lisbon" (a literal type, because it's const)
let year = 2026;               // type: number
let title = "Draft";           // type: string

year = "next";                 // ERROR: Type 'string' is not assignable to type 'number'
```

Notice the difference: `const city` is the *literal* type `"Lisbon"` (it can never change), while `let title` widens to `string`. Hover over a variable in VS Code to see its inferred type.

**Rule of thumb:** annotate function parameters and public return types; let inference handle local variables.

When there is no initial value, inference has nothing to go on, so annotate:

```ts
let result: number;
result = 42;
```

## Literal types

A type can be one exact value. This is surprisingly useful:

```ts
let direction: "north" | "south" | "east" | "west" = "north";
direction = "up";   // ERROR: Type '"up"' is not assignable to type '"north" | "south" | "east" | "west"'
```

The `|` means "or" — a **union**. You'll use unions constantly (see the Intermediate level).

## `any`, `unknown` and `never`

- **`any`** switches the type checker off for that value. Everything is allowed, nothing is checked. Avoid it.
- **`unknown`** means "could be anything, and I must check before using it". It is the safe version of `any`.
- **`never`** means "this can't happen" (a function that always throws, or an impossible branch).

```ts
let a: any = "hello";
a.nonsense();                // compiles! crashes at runtime

let u: unknown = "hello";
// u.toUpperCase();          // ERROR: 'u' is of type 'unknown'
if (typeof u === "string") {
  console.log(u.toUpperCase());   // OK — narrowed to string
}
```

Use `unknown` for values from outside your program (JSON, user input, `catch` clauses) and check them.

## Arrays and objects, briefly

```ts
const scores: number[] = [90, 85, 72];
const user: { name: string; age: number } = { name: "Ada", age: 36 };
```

Both get their own lessons soon.

## Type assertions

Sometimes you know more than the compiler. `as` tells it to trust you:

```ts
const input = document.getElementById("name") as HTMLInputElement;
```

An assertion does **no checking at runtime**. If you are wrong, you get a crash later, not an error now. Prefer narrowing (a real check) over asserting.

## Template of a good habit

```ts
const price = 19.99;
const quantity = 3;
const total = price * quantity;
console.log(`Total: ${total.toFixed(2)}`);   // Total: 59.97
```

No annotations needed; every type was inferred, and everything is checked.

## Common mistakes

- **Using `var`.** Use `const` / `let`.
- **Annotating everything.** `const x: number = 5` adds noise. Let inference work.
- **Reaching for `any`** to silence an error. Use `unknown` and narrow, or fix the type.
- **Confusing `let x = "a"` with `const x = "a"`.** The first is `string`, the second is the literal `"a"`.
- **Thinking types exist at runtime.** They are erased. You can't write `if (x instanceof number)`; use `typeof x === "number"`.
- **Using `Number`, `String`, `Boolean` (capitalised) as types.** Always use lowercase `number`, `string`, `boolean`.

## Exercises

1. Declare a `const` string, a `let` number and a `boolean`. Hover over each in your editor and write down the inferred types.
2. Declare `let status: "idle" | "loading" | "done" = "idle"`, then try assigning `"error"`. Read the message.
3. Write a variable of type `unknown` holding a number, then write code that safely doubles it only if it is a number.
4. Why does `const a = "x"` have a different type than `let b = "x"`?
5. Declare `let id: number | string`, assign each kind of value to it, and print `typeof id` each time.

## Recap

- `const` by default, `let` when you must reassign, never `var`.
- Basic types: `number`, `string`, `boolean`, `bigint`, `symbol`, `null`, `undefined`.
- Inference means you annotate less; annotate parameters and return types.
- Literal types and unions describe exact sets of values.
- `any` disables checking; `unknown` forces a check. Types vanish at runtime.

Next: [Numbers & math →](03-numbers-and-math.md)
