# 7. Modules & `tsconfig`

## What & why

Past a few hundred lines, one file is unmanageable. **Modules** let you split code into files that explicitly share what they choose to export. `tsconfig.json` tells the compiler how to find, check and emit those files. Most "mysterious" TypeScript setup problems are module and configuration problems, so it pays to understand them once.

## ES modules

A file with `import` or `export` is a module; everything in it is private unless exported.

`src/math.ts`:

```ts
export function add(a: number, b: number): number {
  return a + b;
}

export const PI = 3.14159;

export interface Point {
  x: number;
  y: number;
}

export default function greet(name: string): string {   // at most one default per module
  return `Hi ${name}`;
}
```

`src/main.ts`:

```ts
import greet, { add, PI, type Point } from "./math.js";
import * as math from "./math.js";             // namespace import

const p: Point = { x: add(1, 2), y: PI };
console.log(greet("Ada"), math.add(1, 1));
```

Notes:

- **Use the `.js` extension** in relative imports, even though the file is `.ts`. With `NodeNext`, imports are written the way they will look *after* compilation. (If you run `.ts` directly with Node's type stripping, write `.ts` and enable `allowImportingTsExtensions` / `rewriteRelativeImportExtensions`.)
- Prefer **named exports**. They are rename-safe, searchable and tree-shakeable; default exports let each importer pick a different name.

### Type-only imports

```ts
import type { Point } from "./math.js";       // erased completely at compile time
import { add, type Point } from "./math.js";  // inline form
```

Turn on `verbatimModuleSyntax` (as this course's capstones do): then what you write is exactly what is emitted, and importing a type without the `type` keyword becomes an error. It also makes the code compatible with type-stripping tools.

### Re-exports (barrels)

```ts
// src/index.ts
export { add } from "./math.js";
export type { Point } from "./math.js";
export * from "./strings.js";
```

A barrel file gives a library one public entry point. Don't make a barrel for every folder inside an application: it hurts build times and creates circular imports.

## ESM vs CommonJS

Node has two module systems:

- **ES modules**: `import`/`export`, async-capable, the standard. Enabled by `"type": "module"` in `package.json` (or `.mjs` files).
- **CommonJS**: `require()`/`module.exports`, the legacy default.

Use ESM for new code. Differences to remember:

| | ESM | CommonJS |
| --- | --- | --- |
| Top-level `await` | yes | no |
| `__dirname` | use `import.meta.dirname` | built in |
| Import a JSON file | `import data from "./x.json" with { type: "json" }` | `require("./x.json")` |
| File extensions in imports | required | optional |

## `tsconfig.json`, option by option

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],

    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**What to emit**

- `target` — the JavaScript version to produce. Match your minimum Node version (`ES2023` suits Node 20+).
- `lib` — which built-in APIs the type checker knows about (`Map`, `Promise`, `Array.prototype.at`...). Add `"DOM"` only for browser code.
- `module` / `moduleResolution` — how imports are interpreted. `NodeNext` mirrors Node exactly (this is what you want for Node apps and libraries). Browser apps built with a bundler usually use `"module": "ESNext"`, `"moduleResolution": "Bundler"`.
- `types` — which `@types/*` packages are loaded globally. Listing `["node"]` prevents unrelated ones sneaking in.
- `rootDir` / `outDir` — source in, JavaScript out. Keep them separate.
- `sourceMap` — lets debuggers and stack traces point at your `.ts` lines.
- `declaration` — emit `.d.ts` files (needed when publishing a library).

**What to check** (the "strict family")

- `strict` — bundles `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `useUnknownInCatchVariables`, and more. Always on.
- `noUncheckedIndexedAccess` — `arr[i]` and `obj[key]` include `undefined`.
- `exactOptionalPropertyTypes` — `{ a?: string }` can be omitted, but not set to `undefined`.
- `noImplicitOverride` — require the `override` keyword.
- `noFallthroughCasesInSwitch` — flag accidental `switch` fall-through.
- `verbatimModuleSyntax` / `isolatedModules` — keep each file compilable on its own; needed for bundlers and type stripping.
- `skipLibCheck` — don't type-check `.d.ts` files in `node_modules` (speeds builds, avoids third-party conflicts).

**Which files**

- `include` / `exclude` / `files` choose inputs. `include: ["src"]` is typical.

## Project layout

```
my-app/
├── package.json
├── tsconfig.json
├── src/
│   ├── main.ts           # entry point, thin
│   ├── model.ts          # types and pure logic
│   ├── storage.ts        # I/O
│   └── model.test.ts     # tests next to code
└── dist/                 # generated; git-ignored
```

Keep the entry point thin and push logic into importable modules; that is what makes the code testable (lesson 11) and is the shape every capstone uses.

## Scripts

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "check": "tsc --noEmit",
    "start": "node dist/main.js",
    "test": "tsc && node --test \"dist/**/*.test.js\""
  }
}
```

## Dependencies and `@types`

Libraries written in JavaScript need type declarations. Many ship their own; for the rest, install the community package:

```bash
npm install express
npm install --save-dev @types/express
```

Dependencies go in `dependencies`; compilers, types and test tools go in `devDependencies`. Commit `package-lock.json` and use `npm ci` in CI for reproducible installs.

## Circular imports

If `a.ts` imports `b.ts` and `b.ts` imports `a.ts`, you may see `undefined` at import time. Fix by extracting the shared piece into a third module that both import.

## Common mistakes

- **Forgetting `.js` in relative imports** under `NodeNext` ("Relative import paths need explicit file extensions").
- **Mixing `require` and `import`** in the same file.
- **Turning `strict` off** to make errors go away.
- **Compiling to a `target` newer than your Node version** and getting syntax errors at runtime.
- **Committing `dist/`** or `node_modules/`.
- **Using `export default` everywhere,** then fighting inconsistent import names.
- **Deep barrel chains** that create cycles.
- **Importing from `dist/`** instead of from `src/` in your own code.

## Exercises

1. Split the task tracker's `load`/`save` into `storage.ts` and the types into `model.ts`; import them from `main.ts`.
2. Turn on `noUncheckedIndexedAccess` in an old project and fix each error. Which were real bugs?
3. Add `"declaration": true` and look at the generated `.d.ts` file.
4. Create a circular import on purpose, observe the problem, then resolve it by extracting a shared module.
5. Write `check` and `test` scripts and run them.
6. Explain the difference between `module: "NodeNext"` and `module: "ESNext"` with `"moduleResolution": "Bundler"`, and when you'd use each.

## Recap

- A file with `import`/`export` is a module; export only what others need.
- With `NodeNext`, write `.js` in relative imports; use `import type` and `verbatimModuleSyntax`.
- Prefer named exports and ESM (`"type": "module"`).
- `tsconfig.json`: `target`/`lib` for what's available, `module`/`moduleResolution` for how imports work, the strict family for safety.
- Keep entry points thin and logic in modules; avoid import cycles.

Next: [Errors in depth →](08-error-handling.md)
