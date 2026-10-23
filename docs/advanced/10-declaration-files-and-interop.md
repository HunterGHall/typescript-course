# 10. Declaration files & JavaScript interop

## What & why

TypeScript doesn't live alone. You will use JavaScript libraries that have no types, gradually migrate a JavaScript codebase, extend the types of a library you don't own, or describe globals injected by a build tool. All of that runs through **declaration files** (`.d.ts`): files that contain *only types*, describing JavaScript that exists elsewhere.

## What a `.d.ts` file is

A declaration file has no executable code. It tells the compiler "this module/function/global exists, and here is its shape":

`legacy.d.ts` (describing a hypothetical `legacy.js`):

```ts
export function formatMoney(amount: number, currency?: string): string;
export const VERSION: string;
export interface Options {
  locale?: string;
}
export default class Formatter {
  constructor(options?: Options);
  format(n: number): string;
}
```

No function bodies, no initial values. When you `import { formatMoney } from "./legacy.js"`, TypeScript finds `legacy.d.ts` next to `legacy.js` and uses it for checking, while Node loads the real JS.

`tsc` creates `.d.ts` files for you when `declaration: true`; that is how libraries ship types (lesson 11).

## The `declare` keyword

`declare` says "this exists at runtime; don't emit code for it":

```ts
declare const BUILD_ID: string;                       // injected by a bundler's define
declare function gtag(command: string, ...args: unknown[]): void;   // global from a <script> tag
declare namespace MyLib {
  function init(key: string): void;
  const version: string;
}

declare global {                                      // inside a module file: add to the global scope
  interface Window {
    analytics: { track(event: string): void };
  }
  var __DEV__: boolean;
}
export {};                                            // makes this file a module so `declare global` is allowed
```

Remember: a `declare` is a **promise**. The compiler can't verify it. If the global isn't really there, you'll crash at runtime.

## Typing untyped packages

You install a package and get *"Could not find a declaration file for module 'x'"*. Options, best first:

1. **Install community types:** `npm install --save-dev @types/x` (the DefinitelyTyped repository). Matches by package name; scoped packages become `@types/scope__name`.
2. **Check if the package ships its own types:** look for `"types"` in its `package.json`. A recent version may have added them.
3. **Write a minimal declaration** for just what you use:

`types/x.d.ts`:

```ts
declare module "x" {
  export function compress(input: string, level?: number): string;
}
```

Make sure the file is covered by your `include`. A quick-and-dirty escape: `declare module "x";` — everything from it becomes `any`. Fine as a first step; replace it with real types.

4. **Wildcard modules** for assets handled by bundlers:

```ts
declare module "*.svg" {
  const url: string;
  export default url;
}
declare module "*.css";
```

## Module augmentation

Add to an existing module's types without editing it:

```ts
// express-augment.d.ts
import "express";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;                                  // set by your auth middleware
  }
}
```

It *merges* with the library's `Request` interface (declaration merging, Intermediate lesson 1). Augment globals the same way with `declare global`. Use sparingly: each augmentation is a type-level fact you must keep true at runtime.

## Typing the overloaded shapes of JS libraries

JavaScript APIs are often flexible in ways TypeScript must describe with overloads, generics or unions:

```ts
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): (...args: A) => void;

export function query(selector: string): Element | null;
export function query<T extends Element>(selector: string, type: new () => T): T | null;

// "CommonJS-style" export of one function with properties:
declare function log(message: string): void;
declare namespace log {
  var level: "info" | "debug";
  function child(name: string): typeof log;
}
export = log;                                         // pairs with `import log = require("log")` or esModuleInterop
```

`export =` describes `module.exports = something`. With `esModuleInterop` you can then write `import log from "log"`.

## `import()` types and `typeof import`

```ts
type Config = import("./config.js").Config;           // type from a module without a top-level import
type Fs = typeof import("node:fs");                   // the module's whole shape

const mod = await import("./heavy.js");               // dynamic import: lazy-load at runtime
```

Dynamic `import()` returns a Promise of the module namespace and is typed. It is how you lazy-load rarely used code or load ESM from CommonJS.

## Using JavaScript from TypeScript

Mixed projects are normal. Settings:

```json
{
  "compilerOptions": {
    "allowJs": true,       // let TS import .js files
    "checkJs": true,       // type-check .js files too (using JSDoc)
    "maxNodeModuleJsDepth": 0
  }
}
```

You can opt files in or out individually with `// @ts-check` / `// @ts-nocheck` at the top of a file.

### JSDoc: types in `.js` files

TypeScript understands a rich subset of JSDoc, so you can get type checking without converting files:

```js
// @ts-check

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 */

/**
 * @param {User[]} users
 * @param {(u: User) => boolean} [predicate]
 * @returns {string[]}
 */
export function names(users, predicate = () => true) {
  return users.filter(predicate).map((u) => u.name);
}

/** @type {import("./types.js").Config} */
export const config = { /* ... */ };
```

Some teams write whole libraries this way (and generate `.d.ts` with `tsc --allowJs --declaration --emitDeclarationOnly`), avoiding a build step.

### Migrating a JavaScript codebase gradually

1. Add `tsconfig.json` with `allowJs: true`, `checkJs: false`, `noEmit: true`. Nothing breaks.
2. Turn on `checkJs` and fix errors file by file, or opt in with `// @ts-check`.
3. Rename leaf modules (those with no local importers) to `.ts` first, then work up.
4. Start with loose settings (`strict: false`) and tighten one flag at a time: `noImplicitAny`, then `strictNullChecks`, and so on.
5. Replace `any` with `unknown`; add `// @ts-expect-error` (with a reason) for hard cases instead of silencing broadly.
6. Don't rewrite behaviour during migration. Types first; refactoring later.

## Triple-slash directives

```ts
/// <reference types="node" />          // include a package's types
/// <reference path="./globals.d.ts" />  // include a file (rare; prefer tsconfig include)
```

You mostly meet these in older `.d.ts` files. Prefer `types` in `tsconfig.json` and normal imports.

## Checking your own declarations

- `tsc --noEmit` on the project validates that your declarations are well-formed.
- Add a **type test** file that imports the library and exercises its declared API with `Expect<Equal<...>>` and `@ts-expect-error` (lesson 1 and Intermediate lesson 11).
- Tools like `tsd` or `expect-type` formalise this for published packages.
- `skipLibCheck: true` skips checking `.d.ts` files, which hides mistakes in *yours* too; for a library with hand-written declarations, build CI without it.

## Common mistakes

- **Declaring something that doesn't exist** at runtime (`declare const` for a variable the bundler doesn't define).
- **Forgetting `export {}`** (a `.d.ts` or `.ts` file with no import/export is a *script*, so its declarations are global).
- **Putting `.d.ts` outside `include`,** then wondering why the declaration isn't picked up.
- **Using `any` in declarations** permanently. Start loose, then tighten.
- **Mismatched `export =` vs `export default`,** causing "has no default export" or runtime `undefined`.
- **Shipping `@types/*` in `dependencies`** of an application (they belong in `devDependencies`) — but a *library* whose public types reference them needs them as dependencies.
- **Enabling `strict` on a whole legacy codebase in one commit.**

## Exercises

1. Write a `.d.ts` for a small plain-JavaScript function module you create (3 functions, one overloaded).
2. Install a package with no types, write a minimal `declare module` for the two functions you use, then compare with `@types`.
3. Augment `Array<T>` globally with a `last()` method *type*, implement it in a module, and discuss why augmenting built-ins is risky.
4. Add `// @ts-check` and JSDoc to a JavaScript file; find a real bug it reveals.
5. Use `typeof import("node:path")` and `import("./x.js").Foo` types in a small program.
6. Write a type-test file for your declarations with three `Equal` assertions and two `@ts-expect-error` lines.

## Recap

- `.d.ts` files contain only types; `declare` promises that something exists at runtime.
- Prefer `@types/*` or bundled types; write minimal `declare module` blocks when needed.
- Module augmentation and `declare global` extend existing types; keep them true.
- `allowJs`/`checkJs` and JSDoc let TypeScript check JavaScript; migrate leaf-first and tighten flags gradually.
- Test declarations like code.

Next: [Publishing libraries →](11-publishing-libraries.md)
