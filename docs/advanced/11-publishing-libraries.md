# 11. Publishing libraries

## What & why

An application only has to work for you. A **library** has to work for strangers, with their bundlers, their `tsconfig` settings, their module systems and their Node versions, and keep working across your own releases. Getting the packaging right is mostly a handful of `package.json` fields and a discipline about what counts as a breaking change.

## What a published package contains

```
my-lib/
├── package.json
├── README.md
├── LICENSE
└── dist/
    ├── index.js          # ES module output
    ├── index.d.ts        # types
    ├── index.d.ts.map    # (optional) lets "go to definition" reach your .ts
    └── index.js.map      # (optional) source maps
```

Consumers install *compiled JavaScript plus `.d.ts` files*, not your TypeScript. In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": false
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Choose `target` for the **oldest** runtime you support. Keep `skipLibCheck` off for your own CI so declaration mistakes show up.

## The `package.json` that matters

```json
{
  "name": "@yourname/my-lib",
  "version": "1.0.0",
  "description": "One line that says what it does.",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc",
    "test": "tsc && node --test \"dist/**/*.test.js\"",
    "prepublishOnly": "npm run build && npm test"
  },
  "repository": { "type": "git", "url": "git+https://github.com/you/my-lib.git" },
  "keywords": ["typescript"]
}
```

### `exports`: the public surface

`exports` defines *exactly* which entry points exist. Anything not listed can't be imported (so internals stay private), and conditions pick the right file for each consumer:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./testing": {
    "types": "./dist/testing.d.ts",
    "default": "./dist/testing.js"
  }
}
```

- Put **`types` first** in each block; resolution picks the first matching condition.
- `main`/`types` remain as fallbacks for old tooling.
- `files` is an allow-list of what gets published; check it with `npm pack --dry-run`.
- `"sideEffects": false` lets bundlers tree-shake unused exports.

## ESM, CommonJS, or both?

New libraries should be **ESM-only** if they can: it's simpler, and modern Node (22+) can `require()` synchronous ES modules anyway. If you must serve CommonJS consumers, ship **dual packages**: build twice (ESM and CJS), each with its own `.d.ts`:

```json
"exports": {
  ".": {
    "import": { "types": "./dist/esm/index.d.ts", "default": "./dist/esm/index.js" },
    "require": { "types": "./dist/cjs/index.d.cts", "default": "./dist/cjs/index.cjs" }
  }
}
```

Dual packages bring risks (the "dual package hazard": two copies of your module loaded, each with its own state, so `instanceof` fails). Bundlers like **tsup** and **tsdown** automate dual builds. Use **publint** and **Are the Types Wrong?** (`npx @arethetypeswrong/cli --pack`) to catch resolution problems before users do.

## Designing the public API

- **Export a small, deliberate surface.** Everything exported is a promise you must keep.
- Re-export public items from one `index.ts`; keep helpers unexported.
- **Prefer named exports** and explicit return types on exported functions: they document the contract and keep `.d.ts` output stable.
- Don't leak implementation types or third-party types in your signatures unless the dependency is a documented peer.
- Keep types **simple**. A signature that needs a 20-line conditional type to read is a burden on every user's editor.
- Document with TSDoc comments; they show in editor tooltips:

```ts
/**
 * Splits `items` into groups of at most `size`.
 *
 * @param items - the input list
 * @param size - maximum group size, must be a positive integer
 * @returns a new array of groups; the input is not modified
 * @throws {RangeError} if `size` is not a positive integer
 * @example
 * chunk([1, 2, 3], 2); // [[1, 2], [3]]
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("size must be a positive integer");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
```

Generate API docs with **TypeDoc**, and track your public API with **API Extractor**, which writes the exported surface to a file you review in pull requests.

## Dependencies

- `dependencies`: needed at runtime. Keep them few — each one is installed by every consumer.
- `peerDependencies`: things the *consumer* provides and must share with you (e.g. `react`, or `typescript` for a tool). Version ranges should be wide.
- `devDependencies`: your build and test tooling.
- If your **public types** mention a type from a package, it must be a dependency or peer dependency, not a dev one, or users get `any`.

## Semantic versioning and what is breaking

`MAJOR.MINOR.PATCH`:

- **PATCH** — bug fixes, no API change.
- **MINOR** — new, backward-compatible features.
- **MAJOR** — anything that can break a consumer.

In a TypeScript library, **type changes break people**, even if the JavaScript behaves identically:

| Change | Breaking? |
| --- | --- |
| Remove or rename an export | yes |
| Add a required parameter or required property to an input type | yes |
| Make a return type narrower (`string \| undefined` → `string`) | no (usually) |
| Make a return type wider (`string` → `string \| undefined`) | **yes** |
| Add an optional parameter | no |
| Add a member to a union that users `switch` over exhaustively | **yes** for them (their `never` check fails) |
| Tighten a generic constraint | yes |
| Raise the minimum TypeScript or Node version | treat as breaking |

Write a changelog (**Changesets** automates versioning and release notes). Deprecate before removing: `@deprecated Use newThing()` in TSDoc shows a strikethrough in editors.

### Supporting TypeScript versions

Newer syntax in your `.d.ts` can fail on older TypeScript. Decide a minimum (often "the latest two or three minor versions"), test against them in CI, or downlevel declarations with **downlevel-dts**.

## Publishing

```bash
npm login
npm pack --dry-run          # list exactly what would be published
npm publish --access public # scoped packages need --access public the first time
```

Before the first publish: check the name is free, `LICENSE` exists, `files` is right, and install the packed tarball into a scratch project to try it as a consumer would:

```bash
npm pack                    # makes my-lib-1.0.0.tgz
cd ../scratch && npm install ../my-lib/my-lib-1.0.0.tgz
```

Test the import under both `NodeNext` and `Bundler` module resolution, from TypeScript *and* plain JavaScript.

### Automate with CI and provenance

Publish from CI so it's reproducible, and attach **provenance** so users can verify the package came from your repository:

```yaml
name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: read
  id-token: write          # required for provenance
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm test
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Use 2FA on your npm account, scope tokens narrowly, and prefer npm's trusted publishing (OIDC) where available over long-lived tokens. Published versions can't be reused; a mistake means a new version (or `npm deprecate`; `unpublish` is restricted).

## Testing like a consumer

- Run tests against the **built output**, not the source, at least once in CI.
- Add a tiny "smoke test" project that installs the tarball and imports every entry point.
- Add type tests (`@ts-expect-error`, `Expect<Equal<...>>`) for your public types.
- Run in CI across the Node versions you claim in `engines` and on Windows as well as Linux.

## Common mistakes

- **Publishing `src/` and `dist/` both,** or forgetting `files` and shipping tests and secrets (`.env`!).
- **`types` listed after `default`** in `exports`, so TypeScript never sees it.
- **Importing with extensions inconsistently,** leaving users with unresolvable paths.
- **Making a type wider in a minor release.**
- **Putting `typescript` in `dependencies`** of a runtime library.
- **Dual-package state duplication.**
- **Never trying the tarball** before publishing.
- **Relying on `skipLibCheck`** and so shipping broken `.d.ts`.

## Exercises

1. Turn the `chunk` helper into a package: `src/index.ts`, `tsconfig.json`, `package.json` with `exports`; build it.
2. Run `npm pack --dry-run` and confirm only intended files are included. Fix `files` if not.
3. Install the packed tarball into a scratch project and use it from TypeScript (`NodeNext`) and plain JavaScript.
4. Run `npx @arethetypeswrong/cli --pack` and `npx publint`; fix every warning.
5. Write a type test file proving `chunk([1,2,3], 2)` is `number[][]`.
6. For five hypothetical API changes, classify each as patch, minor or major and justify.
7. Add a GitHub Actions workflow that runs tests on three Node versions and two operating systems.

## Recap

- Ship compiled JavaScript plus `.d.ts`; control the surface with `exports` (types first) and `files`.
- Prefer ESM-only; use dual builds only when needed, and verify with publint and Are the Types Wrong?
- Keep the public API small, explicit and documented with TSDoc.
- Type changes can be breaking changes; follow semver and deprecate before removing.
- Test the packed artifact as a consumer, and publish from CI with provenance.

Next: [Capstone: parallel file indexer →](12-capstone-parallel-indexer.md)
