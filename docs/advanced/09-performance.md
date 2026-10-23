# 9. Performance & profiling

## What & why

Fast code matters less than **correct code that is fast where it counts**. Most programs spend nearly all their time in a tiny fraction of their code, and developers are notoriously bad at guessing which fraction. This lesson is a *method*: measure, find the real bottleneck, change one thing, measure again. Then it covers what V8 (Node's JavaScript engine) likes and dislikes, so your changes land in the right place.

!!! note
    TypeScript types are erased before running, so they have **no runtime cost**. Performance work targets the JavaScript that comes out — and, separately, the speed of the *type checker* itself.

## Rule 1: measure

Never optimise on a hunch. Use a repeatable benchmark with realistic input.

### Quick timing

```ts
console.time("parse");
parseEverything(input);
console.timeEnd("parse");

const start = performance.now();
work();
console.log(`${(performance.now() - start).toFixed(1)} ms`);
```

Single runs lie. The engine compiles hot code gradually (interpreter → baseline → optimised), so the first iterations are slow, and garbage collection pauses add noise. Warm up, repeat, and report the **median** (or min), not one run:

```ts
function bench(name: string, fn: () => void, iterations = 50): void {
  for (let i = 0; i < 5; i++) fn();                      // warm up
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t = performance.now();
    fn();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(`${name}: median ${times[Math.floor(times.length / 2)]!.toFixed(2)} ms, min ${times[0]!.toFixed(2)} ms`);
}
```

For serious comparisons use a benchmarking library (**tinybench**, **mitata**) which handles statistics and outliers. Also beware **dead-code elimination**: if the result is unused, the engine may skip the work. Consume the result (return it, accumulate it).

### Build like production

Benchmark the compiled JavaScript with `NODE_ENV=production` and no debugger attached. Don't benchmark through `ts-node` or watch-mode tooling.

## Rule 2: profile

A **profiler** shows where time actually goes. Node has one built in:

```bash
node --cpu-prof --cpu-prof-dir=prof dist/main.js
```

This writes `prof/*.cpuprofile`. Open it in Chrome DevTools (Performance or Memory tab → *Load profile*) or VS Code's profile viewer. Read it as a **flame graph**: the x-axis is time, the y-axis is call stack depth; wide bars are expensive.

Key terms:

- **Self time:** time inside this function alone.
- **Total time:** self time plus everything it called.
- Look for the widest bars with large *self* time first.

Other tools:

```bash
node --inspect dist/main.js      # attach Chrome DevTools (chrome://inspect)
node --prof dist/main.js         # V8's tick profiler + `node --prof-process`
npx clinic doctor -- node dist/main.js   # automated diagnosis
npx 0x dist/main.js              # flame graph
```

Enable source maps (`"sourceMap": true`, run with `node --enable-source-maps`) so profiles and stack traces show your `.ts` lines.

## Rule 3: fix the algorithm first

No micro-optimisation beats choosing the right data structure.

| Mistake | Fix |
| --- | --- |
| `array.includes(x)` in a loop (O(n²)) | build a `Set` first (O(1) lookups) |
| `array.shift()` to dequeue in a big loop | use an index pointer, or a ring buffer |
| String `+=` in a hot loop building megabytes | push to an array, `join("")` once |
| Re-sorting inside a loop | sort once |
| Searching a sorted array linearly | binary search |
| `Object.keys(o).forEach` over millions of items | iterate a `Map`, or arrays |
| `JSON.parse(JSON.stringify(x))` for cloning | `structuredClone`, or avoid copying |

```ts
// O(n * m)
const common = a.filter((x) => b.includes(x));

// O(n + m)
const setB = new Set(b);
const common2 = a.filter((x) => setB.has(x));
```

## Rule 4: reduce work and allocation

Garbage collection is cheap per object but costly in volume, and long GC pauses stall the event loop.

- **Don't allocate in hot loops.** Hoist objects and arrays out; reuse buffers.
- **Avoid needless intermediate arrays.** A chain `a.map().filter().map()` allocates three arrays. A single `for` loop (or a lazy iterator helper) allocates one:

```ts
// three temporary arrays
const total = items.map((i) => i.price).filter((p) => p > 0).reduce((a, b) => a + b, 0);

// one pass
let total2 = 0;
for (const item of items) if (item.price > 0) total2 += item.price;
```

For *typical* sizes the readable chain is fine; change it only when the profiler points at it.

- **Typed arrays** (`Float64Array`, `Uint8Array`) for numeric data: compact, contiguous, no boxing.
- **Buffers over strings** for binary data; avoid converting back and forth.
- **Stream** instead of loading everything (lesson 7).
- Watch **spread in reducers**: `acc = { ...acc, [k]: v }` copies the accumulator every iteration — O(n²). Mutate a local accumulator instead.

## What V8 likes (and when it matters)

Only apply these to code the profiler flags as hot.

1. **Stable object shapes ("hidden classes").** Objects created with the same properties in the same order share a shape, and property access becomes a fast, cacheable offset lookup. Initialise all properties in the constructor, in one order. Avoid adding/deleting properties later:

```ts
class Point {
  constructor(public x: number, public y: number) {}     // always the same shape
}
// slower: ad hoc shapes
const p: Record<string, number> = {};
p["x"] = 1; delete p["x"];                                // `delete` turns the object into slow dictionary mode
```

2. **Monomorphic call sites.** A function that always sees the same type of argument optimises well. One that sees 5+ shapes becomes megamorphic and slow. Discriminated unions with different shapes in one hot loop are still fine in most code; just be aware.
3. **Type-stable variables.** Don't turn a `number` variable into a `string` midway; TypeScript already discourages it.
4. **Small integers ("Smis") are fastest;** floats are boxed in some situations; `bigint` is much slower than `number`.
5. **Holey vs packed arrays.** `new Array(1000)` creates a "holey" array; prefer `[]` + `push`, or `Array.from({ length: n }, ...)`. Never read past the end.
6. **Exceptions are slowish** in hot paths; don't use them for control flow in tight loops.
7. **Closures in hot loops** allocate; hoist them when it's cheap to do so.
8. **`arguments`/rest spreading** of large arrays (`Math.max(...hugeArray)`) can overflow the call stack; loop instead.

Don't write weird code "for V8". Write clear code, profile, and adjust the few functions that matter.

## Memory

```ts
const mem = process.memoryUsage();
console.log(`heap: ${(mem.heapUsed / 1e6).toFixed(0)} MB, rss: ${(mem.rss / 1e6).toFixed(0)} MB`);
```

- **Leaks** in JavaScript are retained references: unbounded caches, forgotten event listeners, closures holding big objects, global registries, growing arrays of "recent" items.
- Take heap snapshots in DevTools (Memory tab), perform an action, snapshot again, and compare to see what grows. `node --heapsnapshot-signal=SIGUSR2` writes one on demand.
- Bound caches (LRU), use `WeakMap`/`WeakRef` for object-keyed metadata, and remove listeners.
- Raise the old-space limit only as a last resort: `node --max-old-space-size=4096`.

## Parallelise last

If a single thread's work is genuinely CPU-bound after fixing the algorithm, spread it across cores with worker threads (lesson 8) — but **measure the speedup**. Messaging and startup overhead can swallow the gain for small tasks, and the Amdahl limit applies: the serial parts of your program cap the total speedup.

## Startup time

CLI tools care about time to first output. Techniques: lazy `await import()` of rarely-used modules, avoid heavy top-level work, bundle with esbuild to cut module resolution, use the Node compile cache (`module.enableCompileCache()`), and keep dependencies few.

## Type-checking performance

Large TypeScript projects can compile slowly. Diagnose:

```bash
npx tsc --extendedDiagnostics          # time per phase, type counts
npx tsc --generateTrace trace-dir      # open in chrome://tracing or Perfetto
```

Fixes, roughly in order of payoff:

- `skipLibCheck: true`; `incremental: true` (or `composite` with **project references**) so unchanged code isn't rechecked.
- Narrow `include`/`types`, so unrelated `@types` aren't loaded.
- Prefer `interface extends` over big intersection types (`&`): interfaces are cached by name; intersections are recomputed.
- Give exported functions **explicit return types**; it saves the checker from inferring huge types and makes `.d.ts` output stable.
- Avoid enormous unions (thousands of members) and very deep recursive conditional types.
- Add `in`/`out` variance annotations on heavy generics (lesson 4).
- Use `tsc --noEmit` for checking in CI and a fast transpiler (esbuild/SWC, or Node's type stripping) for running — type checking and emitting are separate jobs.

## A tuning session, step by step

1. Write a benchmark that reproduces the slowness with realistic data; record the baseline median.
2. Profile. Identify the widest self-time bar.
3. Form a hypothesis ("`includes` inside the filter is quadratic").
4. Change **one** thing.
5. Re-run the benchmark. Keep the change only if it's measurably better *and* the code is no harder to read.
6. Repeat until the target is met, then stop. Add the benchmark to the repo so regressions are visible.

## Common mistakes

- **Optimising without measuring** — and then guessing wrong.
- **Micro-benchmarks** that the engine optimises away, or that run too briefly to be warm.
- **Benchmarking in dev tools,** with source maps and debuggers attached.
- **Reaching for clever code** before fixing an O(n²) algorithm.
- **Using `await` in a loop** for independent I/O (lesson 9 of Intermediate) — the biggest "performance bug" in real Node apps.
- **Blocking the event loop** (lesson 6) and blaming the database.
- **Ignoring memory,** then wondering about long GC pauses.
- **Slow `tsc` blamed on the machine,** when a type-level explosion is the cause.

## Exercises

1. Implement two versions of "find duplicates in an array of 100 000 numbers" (nested loops vs `Set`) and benchmark them with the `bench` helper.
2. Profile a script that sorts, maps and sums a large array; find which line dominates in the flame graph.
3. Demonstrate the O(n²) cost of `acc = { ...acc, [k]: v }` in `reduce`, then fix it.
4. Compare `Math.max(...arr)` with a loop at 10, 100 000 and 500 000 elements.
5. Create an intentional memory leak (an ever-growing array) and find it using two heap snapshots.
6. Run `tsc --extendedDiagnostics` on your largest project; note the check time, then try `skipLibCheck` and `incremental`.
7. Take the indexer capstone, run it at `-j 1`, `-j 2`, `-j 4`, `-j 8`; record time and explain where the speedup stops.

## Recap

- Measure with warm-up, repetition and medians; profile to find the real hot spot.
- Fix algorithms and data structures first; then reduce allocation; micro-tune last.
- V8 favours stable object shapes, monomorphic calls and typed data — apply that only where profiling points.
- Leaks are retained references; find them with heap snapshots.
- Parallelism is a late, measured step. Type-checking speed has its own toolkit (`--extendedDiagnostics`, incremental builds, explicit types).

Next: [Declaration files & JavaScript interop →](10-declaration-files-and-interop.md)
