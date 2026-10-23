# 9. Functions

## What & why

A function packages a computation behind a name so you can reuse and test it. In TypeScript the function's **signature** — parameter types and return type — is a contract the compiler enforces at every call site.

## Declaring and calling

```ts
function add(a: number, b: number): number {
  return a + b;
}

add(2, 3);        // 5
// add(2);        // ERROR: Expected 2 arguments, but got 1
// add(2, "3");   // ERROR: Argument of type 'string' is not assignable to parameter of type 'number'
```

Annotate every parameter. Annotating the return type is good practice for exported functions (it documents intent and catches mistakes inside the body); for small local helpers inference is fine.

## Arrow functions

```ts
const double = (n: number): number => n * 2;
const greet = (name: string) => `Hello, ${name}`;   // return type inferred: string

const pair = (a: number, b: number) => ({ a, b });  // wrap an object literal in parentheses
```

Arrow functions are the standard for callbacks. Declarations (`function f() {}`) are hoisted and give better stack traces; either is fine.

## Optional, default and rest parameters

```ts
function greeting(name: string, punctuation = "!"): string {   // default: type inferred as string
  return `Hello, ${name}${punctuation}`;
}

function describe(name: string, age?: number): string {        // optional: age is number | undefined
  return age === undefined ? name : `${name} (${age})`;
}

function sum(...numbers: number[]): number {                   // rest: collects extra arguments
  return numbers.reduce((a, b) => a + b, 0);
}

greeting("Ada");        // "Hello, Ada!"
sum(1, 2, 3, 4);        // 10
sum(...[5, 6]);         // spread an array into arguments
```

Optional and default parameters must come after required ones.

## Named parameters via objects

When a function takes more than two or three arguments, use one options object. Callers then name each value:

```ts
interface RetryOptions {
  attempts?: number;
  delayMs?: number;
}

function retry(task: () => void, { attempts = 3, delayMs = 100 }: RetryOptions = {}): void {
  // ...
}

retry(() => console.log("hi"), { attempts: 5 });
```

## Return types: `void` and `never`

```ts
function log(message: string): void {          // returns nothing useful
  console.log(message);
}

function fail(message: string): never {        // never returns normally
  throw new Error(message);
}
```

`never` also appears in impossible branches; the compiler uses it to prove a `switch` exhaustive.

## Multiple results

Return a tuple or an object:

```ts
function divmod(a: number, b: number): [quotient: number, remainder: number] {
  return [Math.floor(a / b), a % b];
}
const [q, r] = divmod(17, 5);     // 3, 2

function stats(xs: number[]): { min: number; max: number } {
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
```

Objects scale better as the result grows; names beat positions.

## Functions are values

Functions have **types** and can be passed around:

```ts
type Predicate = (n: number) => boolean;

function countIf(items: number[], test: Predicate): number {
  let count = 0;
  for (const item of items) if (test(item)) count++;
  return count;
}

countIf([1, 2, 3, 4], (n) => n % 2 === 0);    // 2 — `n` is inferred as number
```

Callbacks are the foundation of the closures lesson at the Intermediate level.

## Overloads

When one function legitimately accepts different argument shapes with correlated return types, write overload signatures, followed by one implementation:

```ts
function parse(input: string): number;
function parse(input: string[]): number[];
function parse(input: string | string[]): number | number[] {
  return typeof input === "string" ? Number(input) : input.map(Number);
}

const a = parse("5");          // number
const b = parse(["1", "2"]);   // number[]
```

Only the overload signatures are visible to callers; the implementation signature is not. Often a union type or a generic (Intermediate) is simpler.

## `this`, briefly

Arrow functions capture `this` from where they are written; regular functions get `this` from how they are called. In plain functions you rarely touch `this`; classes (Intermediate) are where it matters.

## Recursion

```ts
function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}
```

Every recursion needs a base case. JavaScript engines have a limited call stack, so very deep recursion (tens of thousands of levels) throws `RangeError: Maximum call stack size exceeded`; use a loop instead.

## Pure functions and side effects

A **pure** function depends only on its arguments and changes nothing else. Pure functions are easy to test and reason about. Keep the logic pure; keep I/O (files, network, `console.log`) at the edges.

## Common mistakes

- **Omitting parameter types.** Under `strict`, that's an implicit-`any` error, and rightly so.
- **Mutating arguments** (arrays and objects are passed by reference to the same object).
- **Using `any` for callbacks.** Write the function type: `(n: number) => boolean`.
- **Forgetting the parentheses around an object literal** returned from an arrow function.
- **Optional parameter before a required one.**
- **Too many positional parameters.** Switch to an options object.
- **Letting a function return in some branches but not others.** The inferred return type becomes `T | undefined`; make it intentional.

## Exercises

1. Write `clamp(value, min, max)` with typed parameters and a return type.
2. Write `average(...numbers: number[])`. What should it do with no arguments? Decide and document.
3. Write `applyTwice(f: (n: number) => number, x: number): number`.
4. Write a function with an options object: `formatName({ first, last, middle? })`.
5. Write overloads for `double(x: number): number` and `double(x: string): string`.
6. Rewrite a function that mutates its array argument so it returns a new array instead.
7. Write `assertNever(x: never): never` (it just throws) and use it in the `default` of a `switch` over a union.

## Recap

- A signature (parameter types + return type) is a contract checked at every call.
- Defaults, optional and rest parameters; options objects for many arguments.
- `void` = no useful result; `never` = never returns.
- Function types let you pass behaviour as data.
- Overloads for correlated signatures; keep functions pure where you can.

Next: [`null`, `undefined` & narrowing →](10-null-and-narrowing.md)
