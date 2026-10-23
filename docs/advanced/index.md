# Advanced

For you if you ship TypeScript and want depth. This level covers the parts of the language and runtime that separate "it compiles" from "it's well designed, fast and safe": the type system as a programming language, conditional and mapped types, branding and variance, decorators, the Node event loop, streams, worker threads, profiling, declaration files, and publishing.

## Lessons

| # | Lesson | You'll learn |
| --- | --- | --- |
| 1 | [The type system as a language](01-type-system-as-a-language.md) | types as sets, `never`/`unknown`, assignability, subtyping, widening, `as const`, narrowing flow |
| 2 | [Conditional types & `infer`](02-conditional-types.md) | `T extends U ? X : Y`, distribution, `infer`, recursive types, building utilities |
| 3 | [Mapped & template literal types](03-mapped-and-template-types.md) | `{ [K in keyof T]: ... }`, key remapping, modifiers, string manipulation at the type level |
| 4 | [Variance & type-level safety](04-variance-and-branding.md) | covariance, contravariance, `in`/`out`, branded types, opaque IDs, `unique symbol`, builder states |
| 5 | [Decorators & metaprogramming](05-decorators.md) | standard decorators, class/method/field decorators, metadata, `Proxy`, `Reflect` |
| 6 | [The event loop & concurrency](06-event-loop.md) | call stack, task and microtask queues, `nextTick`, timers, blocking, backpressure |
| 7 | [Streams & async iterators](07-streams-and-async-iterators.md) | `for await`, async generators, Node streams, `pipeline`, backpressure, Web Streams |
| 8 | [Worker threads](08-worker-threads.md) | `worker_threads`, message passing, transferables, `SharedArrayBuffer`, `Atomics`, pools |
| 9 | [Performance & profiling](09-performance.md) | measuring first, V8 hidden classes, allocations, `--cpu-prof`, flame graphs, type-check speed |
| 10 | [Declaration files & JavaScript interop](10-declaration-files-and-interop.md) | `.d.ts`, `declare`, module augmentation, `@types`, `allowJs`/JSDoc, `import()` types |
| 11 | [Publishing libraries](11-publishing-libraries.md) | `exports` map, dual ESM/CJS, `declaration`, semver, `npm publish`, provenance, CI |
| 12 | [Capstone: parallel file indexer](12-capstone-parallel-indexer.md) | a concurrent, tested application with a worker pool, end to end |

## How to work through it

- Treat lessons as reference material you revisit. The type-level lessons reward a second pass after you've used them in real code.
- Use the [TypeScript Playground](https://www.typescriptlang.org/play) to experiment with types; it shows inferred types and errors instantly.
- Measure before you optimise; the performance lesson is a method, not a checklist.

## When you're done

Build the indexer capstone to the self-check bar: zero type errors under the strictest settings, identical output at any thread count, and a measured speedup over the single-threaded run. Then stop studying and go build something real.
