# The TypeScript Course

A complete, self-paced TypeScript curriculum in Markdown, from your first `console.log` to conditional types, worker threads and publishing a library. Work through it top to bottom, or jump to the level that matches your experience.

## How this course is organized

| Folder | For you if... | Outcome |
| --- | --- | --- |
| [Beginner](beginner/index.md) | You have never written TypeScript (or never finished a course) | Write and run real programs, understand the core language and its types, build a command-line app that saves data |
| [Intermediate](intermediate/index.md) | You know the syntax but unions, generics, modules and `async` still feel shaky | Interfaces, classes, discriminated unions, generics, utility types, modules, Promises, runtime validation, testing, a real project |
| [Advanced](advanced/index.md) | You ship TypeScript and want depth | The type system as a language, conditional and mapped types, branding, decorators, the event loop, streams, worker threads, performance, a concurrent capstone |

Each lesson is one file and follows the same shape:

1. **What & why** – the idea in plain language
2. **Examples** – code you should type out yourself
3. **Common mistakes** – the traps everyone hits
4. **Exercises** – do these; reading is not learning
5. **Recap**

Each level ends with a **capstone** project. The complete, buildable source for all three lives in the [`capstones/`](https://github.com/HunterGHall/typescript-course/tree/main/capstones) folder of the repository, and CI builds and tests them on Linux, macOS and Windows.

## Setup (do this first)

You need **Node.js 22 or newer** and the **TypeScript compiler**. Everything runs on Windows, macOS and Linux.

```bash
node --version
npm --version
```

- **Install Node**: from [nodejs.org](https://nodejs.org/), or with a version manager such as `nvm`, `fnm` or `winget install OpenJS.NodeJS.LTS`
- **Editor**: [VS Code](https://code.visualstudio.com/) has TypeScript support built in; no extension needed

Every example in this course is meant to be run either as a single file or inside a small project:

```bash
npm init -y
npm install --save-dev typescript @types/node
npx tsc --init                  # create tsconfig.json
npx tsc                         # type-check and compile
node dist/main.js               # run the compiled output
node scratch.ts                 # Node 22.18+ can also run .ts files directly (it strips the types)
```

## How to study

- **Type every example.** Copy-paste teaches you nothing.
- **Read the compiler errors.** TypeScript's errors are long but precise; start at the *first* one and read the *last line* of a multi-line error.
- **Break things on purpose.** Change a line, predict the error, compile.
- **Do the exercises before looking anything up.**
- **One lesson per sitting** is plenty. Consistency beats marathons.

## Curriculum at a glance

### Beginner
1. [Setup & your first program](beginner/01-setup-and-first-program.md)
2. [Variables & basic types](beginner/02-variables-and-types.md)
3. [Numbers & math](beginner/03-numbers-and-math.md)
4. [Strings](beginner/04-strings.md)
5. [Booleans & conditionals](beginner/05-booleans-and-conditionals.md)
6. [Loops](beginner/06-loops.md)
7. [Arrays & tuples](beginner/07-arrays.md)
8. [Objects, Maps & Sets](beginner/08-objects-maps-sets.md)
9. [Functions](beginner/09-functions.md)
10. [`null`, `undefined` & narrowing](beginner/10-null-and-narrowing.md)
11. [Files & error handling](beginner/11-files-and-error-handling.md)
12. [Capstone: command-line task tracker](beginner/12-capstone-task-tracker.md)

### Intermediate
1. [Interfaces & type aliases](intermediate/01-interfaces-and-type-aliases.md)
2. [Classes](intermediate/02-classes.md)
3. [Unions & discriminated unions](intermediate/03-unions.md)
4. [Generics](intermediate/04-generics.md)
5. [Utility types](intermediate/05-utility-types.md)
6. [Closures & higher-order functions](intermediate/06-closures.md)
7. [Modules & `tsconfig`](intermediate/07-modules-and-tsconfig.md)
8. [Errors in depth](intermediate/08-error-handling.md)
9. [Promises & async/await](intermediate/09-async-await.md)
10. [JSON & runtime validation](intermediate/10-json-and-validation.md)
11. [Testing](intermediate/11-testing.md)
12. [Capstone: Markdown link checker](intermediate/12-capstone-link-checker.md)

### Advanced
1. [The type system as a language](advanced/01-type-system-as-a-language.md)
2. [Conditional types & `infer`](advanced/02-conditional-types.md)
3. [Mapped & template literal types](advanced/03-mapped-and-template-types.md)
4. [Variance & type-level safety](advanced/04-variance-and-branding.md)
5. [Decorators & metaprogramming](advanced/05-decorators.md)
6. [The event loop & concurrency](advanced/06-event-loop.md)
7. [Streams & async iterators](advanced/07-streams-and-async-iterators.md)
8. [Worker threads](advanced/08-worker-threads.md)
9. [Performance & profiling](advanced/09-performance.md)
10. [Declaration files & JavaScript interop](advanced/10-declaration-files-and-interop.md)
11. [Publishing libraries](advanced/11-publishing-libraries.md)
12. [Capstone: parallel file indexer](advanced/12-capstone-parallel-indexer.md)

## License

Use freely for learning and teaching.
