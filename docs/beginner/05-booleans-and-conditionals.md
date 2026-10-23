# 5. Booleans & conditionals

## What & why

Programs make decisions. A `boolean` is `true` or `false`, and conditionals (`if`, `switch`, the ternary operator) use booleans to choose what runs. JavaScript adds a twist: *any* value can be used as a condition ("truthy" or "falsy"), which is convenient and a classic source of bugs.

## Comparison operators

```ts
5 > 3;          // true
5 >= 5;         // true
5 < 3;          // false
5 === 5;        // true   — strict equality
5 !== 6;        // true
"5" === 5;      // false  — different types
```

Always use `===` and `!==`. The looser `==` performs type coercion (`"5" == 5` is `true`, `null == undefined` is `true`) and TypeScript will often flag comparisons that can never be true. Objects and arrays compare by **identity**, not contents:

```ts
[1, 2] === [1, 2];     // false — two different arrays
const a = [1, 2];
const b = a;
a === b;               // true — same array
```

## Logical operators

```ts
const age = 25;
const hasId = true;

age >= 18 && hasId;     // AND — true only if both are true
age < 13 || age > 65;   // OR  — true if either is true
!hasId;                 // NOT
```

`&&` and `||` **short-circuit**: the right side runs only if needed.

```ts
const user = { name: "Ada" };
user.name && console.log(user.name);   // runs the log only if name is truthy
```

## Truthiness

In a condition, these values are **falsy**: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. Everything else is truthy — including `"0"`, `"false"`, `[]` and `{}`.

```ts
if ("") console.log("never");
if ([]) console.log("empty arrays are truthy");
```

That makes `||` handy for defaults and also dangerous:

```ts
const port1 = 0 || 3000;    // 3000  — oops, 0 was a legitimate value
const port2 = 0 ?? 3000;    // 0     — ?? only replaces null and undefined
```

Use `??` (nullish coalescing) for defaults. Use `||` only when any falsy value should be replaced.

## `if` / `else`

```ts
const score = 82;

if (score >= 90) {
  console.log("A");
} else if (score >= 80) {
  console.log("B");
} else {
  console.log("C or below");
}
```

Always use braces, even for one-line bodies. Skipping them is the origin of countless bugs.

## The ternary operator

An expression that picks between two values:

```ts
const label = score >= 50 ? "pass" : "fail";
```

Nest at most once; beyond that, use `if`.

## `switch`

Best for comparing one value against several constants:

```ts
type Day = "mon" | "tue" | "sat" | "sun";

function kind(day: Day): string {
  switch (day) {
    case "sat":
    case "sun":
      return "weekend";
    case "mon":
    case "tue":
      return "weekday";
  }
}
```

Two things to know:

- Each case **falls through** to the next unless you `break` or `return`. Stacked empty cases (as above) are the intentional use.
- Because `Day` is a union and every member is handled, TypeScript knows the function returns a string on every path. Add `"wed"` to the union and the compiler complains that not all code paths return a value — a free safety net. Lesson 10 and the Intermediate level push this idea further.

## Narrowing with conditions

Conditions don't just choose code; they teach the compiler:

```ts
function describe(value: string | number): string {
  if (typeof value === "string") {
    return value.toUpperCase();   // value: string here
  }
  return value.toFixed(1);        // value: number here
}
```

This is called **narrowing**, and it is the core of working with unions.

## Optional chaining in conditions

```ts
const config: { retries?: number } = {};
if ((config.retries ?? 0) > 0) {
  console.log("will retry");
}
```

## Combining conditions readably

Name complex tests:

```ts
const isAdult = age >= 18;
const canVote = isAdult && hasId;
if (canVote) { /* ... */ }
```

And return early to avoid deep nesting:

```ts
function ship(order: { paid: boolean; address?: string }): string {
  if (!order.paid) return "unpaid";
  if (!order.address) return "no address";
  return "shipped";
}
```

## Common mistakes

- **`=` instead of `===`** in a condition. `if (x = 5)` assigns. TypeScript catches some of these, not all.
- **Using `||` for defaults** when `0`, `""` or `false` are valid values.
- **Forgetting `break`** in a `switch`.
- **Comparing objects or arrays with `===`** and expecting content comparison.
- **Assuming `[]` is falsy.** Test `arr.length === 0`.
- **Deep `if` pyramids.** Return early.

## Exercises

1. Write `grade(score: number): "A" | "B" | "C" | "F"` using `if`/`else if`.
2. Write `isLeapYear(year: number): boolean` using `&&` and `||` (divisible by 4, except centuries unless divisible by 400).
3. Predict the output, then run: `console.log(0 || "a", 0 ?? "a", "" || "b", "" ?? "b", null ?? "c")`.
4. Write a `switch` over a union type of traffic-light colours returning the next colour. Add a fourth colour and read the error.
5. Write `fizzbuzz(n)` that returns `"Fizz"`, `"Buzz"`, `"FizzBuzz"` or the number as a string.
6. Why is `if (list)` a poor way to test for an empty array? What should you write?

## Recap

- Use `===` / `!==`. Objects compare by identity.
- Falsy values: `false 0 -0 0n "" null undefined NaN`. Everything else is truthy.
- `??` for defaults that respect `0` and `""`; `||` replaces any falsy value.
- `if`, ternary, and `switch` (watch fall-through). Return early, name conditions.
- Conditions narrow types, which is how unions become usable.

Next: [Loops →](06-loops.md)
