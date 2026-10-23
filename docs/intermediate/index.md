# Intermediate

For you if you know the syntax but unions, generics, modules and `async` still feel shaky. This level teaches you to model real domains with types, structure a multi-file project, handle asynchronous work, validate data that arrives from outside, and test it all.

## Lessons

| # | Lesson | You'll learn |
| --- | --- | --- |
| 1 | [Interfaces & type aliases](01-interfaces-and-type-aliases.md) | `interface` vs `type`, extension, structural typing, index signatures, `readonly`, `satisfies` |
| 2 | [Classes](02-classes.md) | fields, constructors, `private`/`#private`, inheritance, `abstract`, `implements`, getters |
| 3 | [Unions & discriminated unions](03-unions.md) | union and intersection types, tagged unions, exhaustiveness checking, `as const` |
| 4 | [Generics](04-generics.md) | generic functions, constraints, generic types and classes, defaults, `keyof` |
| 5 | [Utility types](05-utility-types.md) | `Partial` `Required` `Pick` `Omit` `Record` `ReturnType` `Awaited`, `typeof`, indexed access |
| 6 | [Closures & higher-order functions](06-closures.md) | lexical scope, callbacks, factories, memoization, currying, `this` pitfalls |
| 7 | [Modules & `tsconfig`](07-modules-and-tsconfig.md) | ES modules, `import type`, `NodeNext`, `tsconfig` options that matter, project layout |
| 8 | [Errors in depth](08-error-handling.md) | custom `Error` classes, `cause`, `Result` types, error boundaries, `finally` and `using` |
| 9 | [Promises & async/await](09-async-await.md) | `Promise<T>`, `await`, `Promise.all`/`allSettled`/`race`, sequential vs parallel, timeouts |
| 10 | [JSON & runtime validation](10-json-and-validation.md) | `JSON.parse` returns `unknown`, hand-written guards, schemas, `zod`-style parsing, inferring types |
| 11 | [Testing](11-testing.md) | `node:test`, `node:assert`, test structure, mocking, async tests, coverage |
| 12 | [Capstone: link checker](12-capstone-link-checker.md) | a tested, multi-module tool with a library/CLI split |

## How to work through it

- Build a scratch project with `strict` on and keep it open. Many ideas here are best learned by seeing the compiler's reaction.
- After each lesson, find one place in the previous capstone where you could apply it.
- Hover over everything in your editor. Learning to *read inferred types* is the skill of this level.

## When you're done

You should be able to design the types for a small domain before writing any logic, and explain why your design makes invalid states impossible to represent. Then go to [Advanced](../advanced/index.md).
