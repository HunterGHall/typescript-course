# 1. Setup & your first program

## What & why

TypeScript is JavaScript with a **static type system** on top. You write `.ts` files; the compiler (`tsc`) checks them for mistakes and removes the types, leaving plain JavaScript that runs anywhere JavaScript runs. The types exist only at compile time: they cost nothing at runtime, and they catch whole categories of bugs before the program ever runs.

Two tools are involved, and it helps to keep them separate:

- **Node.js** *runs* JavaScript.
- **`tsc`** *checks* TypeScript and (usually) turns it into JavaScript.

## Install

```bash
node --version      # 22 or newer
```

Then create a project:

```bash
mkdir hello-ts
cd hello-ts
npm init -y
npm install --save-dev typescript @types/node
npx tsc --init
```

- `npm init -y` writes `package.json`.
- `typescript` is the compiler. `@types/node` teaches it about Node's built-in modules (`node:fs`, `process`, ...).
- `tsc --init` writes `tsconfig.json`, the compiler's settings. Open it and make sure these are on (the lessons assume them):

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true
  }
}
```

Also add `"type": "module"` to `package.json` so Node treats your files as modern ES modules. `strict: true` is the single most important line: it turns on the checks that make TypeScript worth using.

## Your first program

Create `src/main.ts`:

```ts
const name = "world";
console.log(`Hello, ${name}!`);
```

Compile and run:

```bash
npx tsc
node dist/main.js
```

```
Hello, world!
```

`tsc` read `src/main.ts` and wrote `dist/main.js`. Open that file and look: it's nearly identical, because this program had no types to remove yet.

### Shortcuts for running

- **Node 22.18+ and 24** can run TypeScript directly by stripping the types: `node src/main.ts`. It does not type-check; it just erases annotations. Great for scratch files, but keep using `tsc` to *check*.
- `npx tsc --noEmit` type-checks without writing any files.
- `npx tsc --watch` re-checks every time you save.

## Seeing the compiler work

Change `main.ts` to this and run `npx tsc`:

```ts
const count: number = "three";
console.log(count);
```

```
src/main.ts:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.
```

That error *is* TypeScript. Read it: file, line, column, error code, and a plain-English message. Fix the code, and it compiles.

!!! note
    By default `tsc` still writes the JavaScript even when there are type errors. Add `"noEmitOnError": true` if you want it to stop instead.

## Reading input and arguments

Command-line arguments live in `process.argv`. The first two entries are Node and the script path, so the real arguments start at index 2:

```ts
const args = process.argv.slice(2);
console.log(args);
```

```bash
node dist/main.js apple banana
# [ 'apple', 'banana' ]
```

To read a line the user types, use `node:readline/promises`:

```ts
import { createInterface } from "node:readline/promises";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("What is your name? ");
console.log(`Nice to meet you, ${answer}.`);
rl.close();
```

`await` at the top level works because we are using ES modules (`"type": "module"`).

## Printing

`console.log` prints to standard output; `console.error` prints to standard error. Both accept several arguments and format objects readably:

```ts
console.log("sum:", 1 + 2);
console.log({ id: 1, tags: ["a", "b"] });
console.error("something went wrong");
```

## Common mistakes

- **Running the `.ts` file with plain `node` on an old version.** Before Node 22.18 that fails with a syntax error; compile first or upgrade.
- **Editing `dist/`.** It is generated output. Edit `src/`, then recompile.
- **Forgetting `"type": "module"`** and then being confused by `import` errors.
- **Leaving `strict` off.** You lose most of what TypeScript offers.
- **Ignoring the first error.** Later errors are often caused by the first one.

## Exercises

1. Create the project from scratch and print your name.
2. Make the program print every command-line argument on its own line, numbered from 1.
3. Ask for the user's name *and* age with `readline`, then print a sentence using both. (The age will be a string for now; the next lesson fixes that.)
4. Introduce a deliberate type error, read the message, then fix it.
5. Run `npx tsc --watch` in one terminal and edit your file in another; watch the errors appear and clear.

## Recap

- TypeScript = JavaScript + types, checked by `tsc`, erased before running.
- A project is `package.json` + `tsconfig.json` + `src/`; compile to `dist/`.
- Turn on `strict`. Read the first error first.
- `process.argv.slice(2)` gives command-line arguments; `readline` reads input.

Next: [Variables & basic types →](02-variables-and-types.md)
