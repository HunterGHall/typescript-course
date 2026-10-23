# 6. Closures & higher-order functions

## What & why

A **closure** is a function that remembers the variables from the scope where it was created, even after that scope has finished. A **higher-order function** takes functions as arguments or returns them. Together they are JavaScript's main tool for abstraction: callbacks, factories, private state, memoization, event handlers.

## Closures

```ts
function makeCounter(): () => number {
  let count = 0;                  // lives on, captured by the returned function
  return () => ++count;
}

const a = makeCounter();
const b = makeCounter();
console.log(a(), a(), a());       // 1 2 3
console.log(b());                 // 1  — separate captured `count`
```

`count` is unreachable from outside: a closure gives you **private state** without a class. The function captures the *variable*, not a copy of its value:

```ts
let x = 1;
const show = () => x;
x = 2;
console.log(show());              // 2
```

## Function types in signatures

```ts
type Transform = (input: string) => string;

function applyAll(text: string, transforms: Transform[]): string {
  return transforms.reduce((acc, fn) => fn(acc), text);
}

applyAll(" Hi ", [(s) => s.trim(), (s) => s.toUpperCase()]);   // "HI"
```

Parameter types are **inferred** from the context, so the arrow functions need no annotations.

## Factories

A function that returns a configured function:

```ts
function multiplier(factor: number) {
  return (n: number) => n * factor;
}

const double = multiplier(2);
const triple = multiplier(3);
[1, 2, 3].map(double);            // [2, 4, 6]
```

```ts
function createLogger(prefix: string) {
  return {
    info: (msg: string) => console.log(`[${prefix}] ${msg}`),
    error: (msg: string) => console.error(`[${prefix}] ${msg}`),
  };
}

const log = createLogger("db");
log.info("connected");
```

## The classic loop bug

```ts
const fns: Array<() => number> = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => i);
}
console.log(fns.map((f) => f()));       // [3, 3, 3]  — one shared `var i`

const fixed: Array<() => number> = [];
for (let j = 0; j < 3; j++) {
  fixed.push(() => j);
}
console.log(fixed.map((f) => f()));     // [0, 1, 2]  — a fresh `let j` per iteration
```

This is the best demonstration of why `var` is avoided: `let` gives each iteration its own binding.

## Higher-order utilities

### `once`

```ts
function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let called = false;
  let result: R;
  return (...args) => {
    if (!called) {
      result = fn(...args);
      called = true;
    }
    return result;
  };
}
```

`A extends unknown[]` captures the *whole parameter list* as a tuple, so the wrapper has exactly the same signature as the original.

### Memoization

```ts
function memoize<A, R>(fn: (arg: A) => R): (arg: A) => R {
  const cache = new Map<A, R>();
  return (arg) => {
    if (cache.has(arg)) return cache.get(arg)!;
    const value = fn(arg);
    cache.set(arg, value);
    return value;
  };
}

const slowSquare = (n: number) => { /* imagine expensive work */ return n * n; };
const fastSquare = memoize(slowSquare);
```

Only memoize **pure** functions, and remember the cache grows forever unless you bound it.

### Debounce

```ts
function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
```

`ReturnType<typeof setTimeout>` is `number` in browsers and `NodeJS.Timeout` in Node — deriving it keeps the code portable.

## Composition and currying

```ts
const compose =
  <T>(...fns: Array<(x: T) => T>) =>
  (x: T) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

const slugify = compose<string>(
  (s) => s.replace(/\s+/g, "-"),
  (s) => s.toLowerCase(),
  (s) => s.trim(),
);
slugify("  Hello Big World ");    // "hello-big-world"

const add = (a: number) => (b: number) => a + b;   // curried
add(2)(3);                                         // 5
```

Compose small, single-purpose functions. Stay readable: deep point-free pipelines are not a virtue.

## Callbacks and `this`

Regular functions get their own `this`; arrow functions use the surrounding one:

```ts
class Timer {
  seconds = 0;
  start() {
    setInterval(() => {
      this.seconds++;           // arrow: `this` is the Timer
    }, 1000);
  }
}
```

If you write `function () { this.seconds++ }` there, `this` would be something else. In TypeScript you can also declare it: `function (this: Timer) { ... }`.

## Immutability helps closures

Closures capturing mutable variables can surprise you when the variable changes later. Prefer `const`, copy values you need to freeze at a point in time, and keep captured state small and private.

## Memory note

A closure keeps everything it references alive. A long-lived callback (an event listener, a timer) that captures a huge object keeps it from being garbage collected. Remove listeners and clear timers you no longer need.

## Common mistakes

- **`var` in loops** capturing the shared variable.
- **Forgetting that closures capture variables, not values.**
- **Memoizing impure functions** or functions with object arguments (the `Map` key is identity).
- **Losing `this`** when passing methods as callbacks.
- **Leaking memory** through long-lived callbacks.
- **Annotating callback parameters** that inference already knows: `arr.map((n: number) => ...)` is noise.
- **Over-nesting** — a pyramid of callbacks is a sign to extract named functions (or use `async`/`await`, next lessons).

## Exercises

1. Write `makeAccumulator(start)` returning a function that adds its argument to a running total.
2. Write `partial(fn, a)` that fixes the first argument of a two-argument function.
3. Write `throttle(fn, ms)` that runs at most once per interval.
4. Write `pipe(...fns)` (left-to-right composition) with sensible types for three fixed stages.
5. Reproduce the `var` loop bug and fix it two ways (`let`, and an IIFE).
6. Add a `maxSize` bound with simple eviction to `memoize`.

## Recap

- A closure captures variables from its defining scope; it enables private state.
- Higher-order functions accept or return functions: factories, wrappers, composition.
- `A extends unknown[]` preserves a function's argument list when wrapping.
- `let` creates a fresh binding per loop iteration; `var` does not.
- Arrow functions keep the outer `this`; watch for memory held by long-lived closures.

Next: [Modules & `tsconfig` →](07-modules-and-tsconfig.md)
