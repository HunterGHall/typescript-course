# 3. Numbers & math

## What & why

TypeScript has **one** everyday numeric type, `number`: a 64-bit floating-point value (IEEE 754 double). There is no separate `int`. That is simple, but it brings a few sharp edges you need to know about, plus a second type, `bigint`, for when you need exact big integers.

## Arithmetic

```ts
console.log(7 + 2);     // 9
console.log(7 - 2);     // 5
console.log(7 * 2);     // 14
console.log(7 / 2);     // 3.5  — division is never integer division
console.log(7 % 2);     // 1    — remainder
console.log(2 ** 10);   // 1024 — exponent
```

For integer division, round explicitly:

```ts
Math.floor(7 / 2);   // 3  (toward negative infinity)
Math.trunc(-7 / 2);  // -3 (toward zero)
```

The remainder keeps the sign of the left operand: `-7 % 3` is `-1`, not `2`. For a true modulo, use `((a % n) + n) % n`.

Compound assignment and increments work as you'd expect:

```ts
let n = 5;
n += 3;   // 8
n *= 2;   // 16
n++;      // 17
```

## Floating point surprises

```ts
console.log(0.1 + 0.2);            // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);    // false
```

This is not a TypeScript bug; every language using doubles behaves the same. Compare with a tolerance, or work in whole units (cents, not dollars):

```ts
const close = (a: number, b: number) => Math.abs(a - b) < Number.EPSILON * 10;
console.log(close(0.1 + 0.2, 0.3));   // true
```

Format for display with `toFixed`, which returns a **string**:

```ts
(59.966).toFixed(2);   // "59.97"
```

## Parsing and converting

Text becomes a number with `Number()`, `parseInt()` or `parseFloat()`. They differ:

```ts
Number("42");        // 42
Number("42px");      // NaN  — strict
Number("");          // 0    — surprise!
parseInt("42px", 10);// 42   — stops at the first bad character
parseFloat("3.5kg"); // 3.5
```

Always pass the radix (`10`) to `parseInt`. A robust integer parser:

```ts
function parseIntStrict(text: string): number | undefined {
  const n = Number(text);
  return text.trim() !== "" && Number.isInteger(n) ? n : undefined;
}

console.log(parseIntStrict("12"));    // 12
console.log(parseIntStrict("1.5"));   // undefined
console.log(parseIntStrict(""));      // undefined
```

## `NaN` and `Infinity`

`NaN` ("not a number") is the result of a failed numeric operation, and it is a `number`:

```ts
const x = Number("abc");       // NaN
console.log(typeof x);         // "number"
console.log(x === NaN);        // false — NaN is never equal to anything, even itself
console.log(Number.isNaN(x));  // true  — the correct test
console.log(1 / 0);            // Infinity
```

Use `Number.isNaN`, not the older global `isNaN` (which coerces its argument first).

## The `Math` object

```ts
Math.round(2.5);        // 3
Math.ceil(2.1);         // 3
Math.floor(2.9);        // 2
Math.abs(-4);           // 4
Math.max(1, 9, 4);      // 9
Math.min(...[3, 1, 2]); // 1
Math.sqrt(16);          // 4
Math.PI;                // 3.14159...
Math.random();          // 0 <= x < 1
```

A random integer from `min` to `max` inclusive:

```ts
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

`Math.random()` is not suitable for security. Use `crypto.randomInt` from `node:crypto` for that.

## Safe integers and `bigint`

Doubles represent integers exactly only up to 2^53 − 1:

```ts
console.log(Number.MAX_SAFE_INTEGER);        // 9007199254740991
console.log(Number.MAX_SAFE_INTEGER + 2);    // 9007199254740992  — wrong!
console.log(Number.isSafeInteger(2 ** 53));  // false
```

For exact big integers, use `bigint` (literal ends in `n`):

```ts
const huge = 9007199254740993n;
console.log(huge + 2n);            // 9007199254740995n
// huge + 1                        // ERROR: can't mix bigint and number
console.log(BigInt(10) * 3n);      // 30n
```

`bigint` and `number` don't mix implicitly; convert on purpose with `BigInt(x)` / `Number(x)`.

## Number formatting

```ts
(1234567.891).toLocaleString("en-US");                       // "1,234,567.891"
new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(19.5);  // "$19.50"
(255).toString(16);                                          // "ff"
(0.5).toFixed(0);                                            // "1" (careful: rounding quirks)
```

Numeric separators make big literals readable: `1_000_000`.

## Common mistakes

- **Comparing floats with `===`.** Use a tolerance or integer units.
- **`x === NaN`.** Always false; use `Number.isNaN(x)`.
- **`Number("")` is `0`**, and `Number(null)` is `0`. Validate before converting.
- **Forgetting `toFixed` returns a string.** Don't do arithmetic on its result.
- **Using `+` to add numbers that are actually strings:** `"1" + 2` is `"12"`.
- **Mixing `bigint` and `number`** in one expression is a type error.

## Exercises

1. Print `10 / 3`, `Math.floor(10 / 3)` and `10 % 3`, and explain each.
2. Write `average(numbers: number[]): number` and show what it returns for an empty array. Is that a good answer?
3. Write `isEven(n: number): boolean` that also works correctly for negative numbers.
4. Write `parseIntStrict` for yourself and test it with `"007"`, `" 5 "`, `"1e3"`, `"0x10"`. Which results surprise you?
5. Compute 25! (factorial) with `number` and again with `bigint`. Compare.
6. Convert a price in dollars (e.g. `19.99`) to integer cents safely and back.

## Recap

- One `number` type (a double); `bigint` for exact big integers.
- `/` is always floating-point division; round explicitly.
- `0.1 + 0.2 !== 0.3`; use tolerances or integer units.
- `Number.isNaN`, `Number.isInteger`, `Number.isSafeInteger` are the reliable checks.
- Parse deliberately: `Number`, `parseInt(x, 10)`, `parseFloat` behave differently.

Next: [Strings →](04-strings.md)
