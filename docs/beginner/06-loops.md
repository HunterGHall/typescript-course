# 6. Loops

## What & why

Loops repeat work. TypeScript inherits JavaScript's several loop forms; in modern code you will mostly use `for...of` for walking collections, array methods for transforming them, and the classic `for` when you need an index.

## `for...of`: the default

Walk the *values* of anything iterable (arrays, strings, Maps, Sets):

```ts
const fruits = ["apple", "banana", "cherry"];

for (const fruit of fruits) {
  console.log(fruit);
}

for (const ch of "hi") {
  console.log(ch);   // "h", then "i"
}
```

Use `const` for the loop variable; a fresh binding is created every iteration.

## The classic `for`

Three parts: initialise, test, step.

```ts
for (let i = 0; i < 5; i++) {
  console.log(i);    // 0 1 2 3 4
}

// counting backwards, in steps
for (let i = 10; i > 0; i -= 3) {
  console.log(i);    // 10 7 4 1
}
```

Always use `let` (never `var`) for the counter. Use this form when you truly need the index or a custom step.

## Index *and* value: `entries()`

```ts
for (const [index, fruit] of fruits.entries()) {
  console.log(`${index + 1}. ${fruit}`);
}
```

This destructures each `[index, value]` pair, and avoids the manual `fruits[i]` (which, with `noUncheckedIndexedAccess`, would be `string | undefined`).

## `for...in`: the one to be careful with

`for...in` walks an object's **keys** (as strings), including inherited ones:

```ts
const user = { name: "Ada", age: 36 };
for (const key in user) {
  console.log(key);   // "name", "age"  — key is typed string, not "name" | "age"
}
```

Prefer `Object.keys`, `Object.values` and `Object.entries` with `for...of`:

```ts
for (const [key, value] of Object.entries(user)) {
  console.log(`${key} = ${value}`);
}
```

Never use `for...in` on arrays: you get string indices, in no promised order.

## `while` and `do...while`

```ts
let n = 1;
while (n < 100) {
  n *= 2;
}
console.log(n);   // 128

let attempts = 0;
do {
  attempts++;       // runs at least once
} while (attempts < 3);
```

Use `while` when you don't know in advance how many iterations you need: reading until end-of-input, retrying, searching.

## `break`, `continue` and labels

```ts
for (const n of [1, 2, 3, 4, 5, 6]) {
  if (n % 2 === 0) continue;   // skip evens
  if (n > 4) break;            // stop entirely
  console.log(n);              // 1 3
}
```

To leave an outer loop from an inner one, label it:

```ts
outer: for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 3; col++) {
    if (row * col === 2) break outer;
    console.log(row, col);
  }
}
```

Labels are rare; often extracting a function and `return`ing is clearer.

## Array methods instead of loops

Much looping is really *transforming*. These say what you mean:

```ts
const nums = [1, 2, 3, 4, 5];

nums.map((n) => n * 2);               // [2, 4, 6, 8, 10]
nums.filter((n) => n % 2 === 1);      // [1, 3, 5]
nums.reduce((sum, n) => sum + n, 0);  // 15
nums.some((n) => n > 4);              // true
nums.every((n) => n > 0);             // true
nums.find((n) => n > 2);              // 3
```

`forEach` exists but can't `break` or `return` early, and doesn't wait for `await` inside it (a trap you'll meet in the async lesson). Use `for...of` when you need those.

## Generating ranges

JavaScript has no built-in range, but this does it:

```ts
const range = Array.from({ length: 5 }, (_, i) => i);   // [0, 1, 2, 3, 4]
```

## Iterating Maps and Sets

```ts
const ages = new Map([["ada", 36], ["bob", 41]]);
for (const [name, age] of ages) {
  console.log(name, age);
}
```

## Infinite loops and safety

```ts
while (true) {
  const line = readNext();
  if (line === undefined) break;
  // ...
}
```

Always make sure something inside the loop can end it. If a program seems frozen, `Ctrl+C` stops it.

## Common mistakes

- **Off-by-one:** `i <= arr.length` runs one step too many; use `<`.
- **`for...in` on arrays.** Use `for...of`.
- **Modifying an array while looping over it** (adding/removing items). Build a new array or loop over a copy.
- **`forEach` with `async` callbacks** — the loop doesn't wait. Use `for...of` with `await`.
- **Using `var` as the counter** and capturing it in callbacks.
- **Forgetting that `for...of` gives values, `for...in` gives keys.**

## Exercises

1. Print the numbers 1 to 20, replacing multiples of 3 with "Fizz".
2. Sum an array of numbers three ways: `for`, `for...of`, `reduce`.
3. Print a multiplication table (1–9) with aligned columns using `padStart`.
4. Given a string, count its vowels with `for...of`.
5. Find the first number divisible by both 7 and 13 greater than 1000 using `while`.
6. Print the entries of an object, sorted by key.
7. Produce the first 15 Fibonacci numbers in an array.

## Recap

- `for...of` for values; `.entries()` when you need the index too.
- Classic `for` for counters and custom steps; `while` when the count is unknown.
- `for...in` is for object keys only, and `Object.entries` is usually better.
- `break`, `continue`, and rare labels control flow.
- Prefer `map`/`filter`/`reduce` when you're transforming data.

Next: [Arrays & tuples →](07-arrays.md)
