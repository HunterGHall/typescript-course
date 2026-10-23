# 12. Capstone: Markdown link checker

## Goal

Build a real tool with a proper project structure, a library/CLI split, and tests. It scans Markdown files, extracts every link, checks that local files and `#anchors` exist, and prints a report with a CI-friendly exit code.

This exercises: discriminated unions, generators, regular expressions, `node:fs/promises`, async/await, pure functions that are easy to test, `node:test`, and a thin entry point.

The finished, tested source is in [`capstones/link-checker`](https://github.com/HunterGHall/typescript-course/tree/main/capstones/link-checker) and is built by CI on Linux, macOS and Windows.

## What it does

```
$ linkcheck docs/

docs/index.md
  OK    3:./setup.md
  FAIL  4:./missng.md  (file not found)
  FAIL  7:./setup.md#instal  (no heading #instal in ./setup.md)
  SKIP  9:https://example.com  (external URL)

docs/setup.md
  OK    12:#install

Checked 5 links in 2 files: 2 OK, 2 broken, 1 skipped
$ echo $?
1
```

## Requirements

1. Recursively find `.md` files under one or more given paths (default: `.`). Skip `node_modules` and dot-folders.
2. Extract links: inline `[text](target)`, images `![alt](target)`, reference definitions `[ref]: target`, and autolinks `<https://...>`. Ignore anything inside fenced code blocks and inline code.
3. Classify each link: **URL** (has a scheme like `https:`), **anchor** (`#section`), or **local file**.
4. **Local files**: resolve relative to the containing file; check existence. If the target is a `.md` file with a `#fragment`, check the heading exists.
5. **Anchors**: check against the file's own headings, using GitHub's slug rules (`## Hello, World!` becomes `#hello-world`, and duplicates get `-1`, `-2`).
6. **URLs**: report as skipped (a checker that hits the network is a stretch goal).
7. `-q` / `--quiet` prints only broken links.
8. Exit code: `0` all good, `1` broken links found, `2` usage or I/O error.

## Project layout

```
link-checker/
├── package.json
├── tsconfig.json
└── src/
    ├── links.ts          # pure: extractLinks, classify, slugify, headingSlugs
    ├── checker.ts        # filesystem: findMarkdownFiles, checkFile
    ├── main.ts           # argument parsing + report (thin)
    ├── links.test.ts     # pure functions — no files
    └── checker.test.ts   # uses a temporary directory
```

The split matters: `links.ts` is **pure** (text in, data out) and trivially testable. `checker.ts` touches the filesystem. `main.ts` handles arguments and output only. Put the logic in modules, keep the entry point thin — the shape from the modules and testing lessons.

## Setup

```bash
mkdir link-checker && cd link-checker
npm init -y
npm install --save-dev typescript @types/node
mkdir src
```

`package.json` (the parts that matter):

```json
{
  "type": "module",
  "bin": { "linkcheck": "dist/main.js" },
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsc",
    "test": "tsc && node --test \"dist/**/*.test.js\""
  }
}
```

`tsconfig.json` uses the strict settings from the modules lesson: `NodeNext`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `rootDir: "src"`, `outDir: "dist"`.

## Step 1: the types

Model a link's *kind* as a discriminated union so each branch carries exactly the data it needs:

```ts
export interface Link {
  line: number;     // 1-based
  target: string;   // exactly as written, minus any title
}

export type LinkKind =
  | { kind: "url" }
  | { kind: "anchor"; fragment: string }
  | { kind: "file"; path: string; fragment: string | undefined };
```

## Step 2: parsing (pure code)

Write `src/links.ts`. Each function takes a string and returns data, so there's nothing to mock. Write the tests (below) first if you like.

```ts
/** A link found in a Markdown document. */
export interface Link {
  line: number; // 1-based
  target: string; // exactly as written, minus any title
}

export type LinkKind =
  | { kind: "url" }
  | { kind: "anchor"; fragment: string }
  | { kind: "file"; path: string; fragment: string | undefined };

// MARK: classification

/** "https:", "mailto:" — but not a Windows drive letter such as "C:\". */
function hasScheme(text: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]+:/.test(text);
}

export function classify(target: string): LinkKind {
  if (target.startsWith("#")) return { kind: "anchor", fragment: target.slice(1) };
  if (hasScheme(target)) return { kind: "url" };

  let path = target;
  let fragment: string | undefined;
  const hash = path.indexOf("#");
  if (hash !== -1) {
    fragment = path.slice(hash + 1);
    path = path.slice(0, hash);
  }
  const question = path.indexOf("?");
  if (question !== -1) path = path.slice(0, question);
  return { kind: "file", path, fragment };
}

// MARK: headings and slugs

/** GitHub-style anchor: "Hello, World!" -> "hello-world". */
export function slugify(heading: string): string {
  let slug = "";
  for (const ch of heading.toLowerCase()) {
    if (/[\p{L}\p{N}_-]/u.test(ch)) slug += ch;
    else if (ch === " ") slug += "-";
    // everything else (punctuation) is dropped
  }
  return slug;
}

/** Yields the lines of `text` outside fenced code blocks, with 1-based numbers. */
function* proseLines(text: string): Generator<[number, string]> {
  let fence: string | undefined;
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (m) {
      const marker = m[1]![0]!;
      if (fence === undefined) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence === undefined) yield [i + 1, line];
  }
}

/** The set of anchors a document offers; duplicates get -1, -2 ... like GitHub. */
export function headingSlugs(text: string): Set<string> {
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  for (const [, line] of proseLines(text)) {
    const m = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slugify(m[1]!.replace(/[`*_]/g, ""));
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

// MARK: extraction

function stripTitle(raw: string): string {
  const target = raw.trim();
  if (target.startsWith("<") && target.includes(">")) return target.slice(1, target.indexOf(">"));
  const space = target.search(/\s/);
  return space === -1 ? target : target.slice(0, space);
}

/** Finds inline links, images, reference definitions and autolinks, skipping code. */
export function extractLinks(text: string): Link[] {
  const links: Link[] = [];
  for (const [line, raw] of proseLines(text)) {
    const code = raw.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));

    const reference = /^ {0,3}\[[^\]]+\]:\s*(\S+)/.exec(code);
    if (reference) {
      links.push({ line, target: reference[1]! });
      continue;
    }
    for (const m of code.matchAll(/\]\(([^)]*)\)/g)) {
      const target = stripTitle(m[1]!);
      if (target !== "") links.push({ line, target });
    }
    for (const m of code.matchAll(/<([A-Za-z][A-Za-z0-9+.-]+:[^>\s]+)>/g)) {
      links.push({ line, target: m[1]! });
    }
  }
  return links;
}
```

Things to study:

- **`proseLines` is a generator.** It filters out fenced code once, and both `headingSlugs` and `extractLinks` reuse it, so the fence logic lives in one place.
- **`hasScheme` requires two or more letters** before the colon, so `C:\docs` (a Windows path) is not mistaken for a URL.
- **`classify` returns a union**; later code uses `kind.kind` to narrow, and the compiler guarantees every kind is handled.
- **`slugify` uses a Unicode-aware regex** (`\p{L}`), so headings in any language work.
- **Inline code is blanked out** (replaced by spaces of equal length) rather than removed, so link positions stay accurate.

## Step 3: checking (the filesystem)

`src/checker.ts` combines the pure pieces with I/O:

```ts
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { classify, extractLinks, headingSlugs, type Link } from "./links.js";

export type Verdict =
  | { status: "ok" }
  | { status: "skipped"; reason: string }
  | { status: "broken"; reason: string };

export interface Result {
  file: string;
  link: Link;
  verdict: Verdict;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Recursively finds .md files under each path (a file path is returned as is). */
export async function findMarkdownFiles(paths: string[]): Promise<string[]> {
  const found: string[] = [];
  async function walk(path: string): Promise<void> {
    const info = await stat(path);
    if (info.isFile()) {
      if (extname(path) === ".md") found.push(path);
      return;
    }
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(join(path, entry.name));
    }
  }
  for (const p of paths) await walk(p);
  return found.sort();
}

/** Checks every link in one Markdown file. */
export async function checkFile(file: string): Promise<Result[]> {
  const text = await readFile(file, "utf8");
  const ownSlugs = headingSlugs(text);
  const results: Result[] = [];

  for (const link of extractLinks(text)) {
    const kind = classify(link.target);
    let verdict: Verdict;

    if (kind.kind === "url") {
      verdict = { status: "skipped", reason: "external URL" };
    } else if (kind.kind === "anchor") {
      verdict = ownSlugs.has(kind.fragment.toLowerCase())
        ? { status: "ok" }
        : { status: "broken", reason: `no heading #${kind.fragment}` };
    } else {
      const target = resolve(dirname(file), decodeURIComponent(kind.path));
      if (!(await exists(target))) {
        verdict = { status: "broken", reason: "file not found" };
      } else if (kind.fragment && extname(target) === ".md") {
        const slugs = headingSlugs(await readFile(target, "utf8"));
        verdict = slugs.has(kind.fragment.toLowerCase())
          ? { status: "ok" }
          : { status: "broken", reason: `no heading #${kind.fragment} in ${kind.path}` };
      } else {
        verdict = { status: "ok" };
      }
    }
    results.push({ file, link, verdict });
  }
  return results;
}
```

Things to study:

- **`Verdict` is another discriminated union** — `ok`, `skipped` and `broken` each carry what they need (`reason` only where it makes sense).
- **`exists` uses try/catch around `stat`**, not check-then-use. That avoids a race and handles permissions errors uniformly.
- **`decodeURIComponent`** turns `my%20file.md` into a real file name.
- The recursive `walk` is an inner `async` function that closes over `found`.

## Step 4: the command-line wrapper

`src/main.ts` is deliberately boring. It parses flags, calls the library, and prints:

```ts
import { checkFile, findMarkdownFiles, type Result } from "./checker.js";

const args = process.argv.slice(2);
const quiet = args.includes("-q") || args.includes("--quiet");
const paths = args.filter((a) => !a.startsWith("-"));

let files: string[];
try {
  files = await findMarkdownFiles(paths.length > 0 ? paths : ["."]);
} catch (error) {
  console.error(`linkcheck: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const tag = { ok: "OK   ", skipped: "SKIP ", broken: "FAIL " } as const;
const totals = { ok: 0, skipped: 0, broken: 0 };
let count = 0;

for (const file of files) {
  const results: Result[] = await checkFile(file);
  count += results.length;
  for (const r of results) totals[r.verdict.status]++;

  const shown = quiet ? results.filter((r) => r.verdict.status === "broken") : results;
  if (shown.length === 0) continue;
  console.log(`\n${file}`);
  for (const r of shown) {
    const note = r.verdict.status === "ok" ? "" : `  (${r.verdict.reason})`;
    console.log(`  ${tag[r.verdict.status]} ${r.link.line}:${r.link.target}${note}`);
  }
}

console.log(
  `\nChecked ${count} links in ${files.length} files: ` +
    `${totals.ok} OK, ${totals.broken} broken, ${totals.skipped} skipped`,
);
process.exit(totals.broken > 0 ? 1 : 0);
```

Notice:

- **Top-level `await`** works because this is an ES module.
- **`totals[r.verdict.status]++`** indexes an object with a union key; the `as const` tag table and `totals` share the same three keys, so typos are compile errors.
- The program ends with `process.exit(...)` and a meaningful exit code, which is what makes it useful in CI.

## Step 5: tests

Pure functions first: no files, no setup.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, extractLinks, headingSlugs, slugify } from "./links.js";

describe("classify", () => {
  it("recognises URLs, anchors and files", () => {
    assert.deepEqual(classify("https://example.com"), { kind: "url" });
    assert.deepEqual(classify("mailto:a@b.c"), { kind: "url" });
    assert.deepEqual(classify("#intro"), { kind: "anchor", fragment: "intro" });
    assert.deepEqual(classify("./a.md#x"), { kind: "file", path: "./a.md", fragment: "x" });
    assert.deepEqual(classify("a.md?raw=1"), { kind: "file", path: "a.md", fragment: undefined });
  });

  it("does not mistake a Windows drive letter for a scheme", () => {
    assert.equal(classify("C:\\docs\\a.md").kind, "file");
  });
});

describe("slugify", () => {
  it("follows GitHub's rules", () => {
    assert.equal(slugify("Hello, World!"), "hello-world");
    assert.equal(slugify("Getting Started"), "getting-started");
    assert.equal(slugify("snake_case & kebab-case"), "snake_case--kebab-case");
  });
});

describe("headingSlugs", () => {
  it("numbers duplicates and ignores code fences", () => {
    const md = ["# Intro", "## Setup", "## Setup", "```", "# not a heading", "```"].join("\n");
    assert.deepEqual([...headingSlugs(md)], ["intro", "setup", "setup-1"]);
  });
});

describe("extractLinks", () => {
  it("finds inline links, images, references and autolinks with line numbers", () => {
    const md = [
      'See [a](./a.md) and ![img](pic.png "title").',
      "[ref]: ./b.md",
      "<https://example.com>",
    ].join("\n");
    assert.deepEqual(extractLinks(md), [
      { line: 1, target: "./a.md" },
      { line: 1, target: "pic.png" },
      { line: 2, target: "./b.md" },
      { line: 3, target: "https://example.com" },
    ]);
  });

  it("skips fenced and inline code", () => {
    const md = ["`[x](nope.md)`", "```", "[y](nope2.md)", "```", "[z](yes.md)"].join("\n");
    assert.deepEqual(extractLinks(md), [{ line: 5, target: "yes.md" }]);
  });
});
```

Then the filesystem layer, using a fresh temporary directory so tests never touch real files:

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { checkFile, findMarkdownFiles } from "./checker.js";

describe("checker", () => {
  let dir: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "linkcheck-"));
    await mkdir(join(dir, "sub"));
    await writeFile(join(dir, "setup.md"), "# Install\n");
    await writeFile(
      join(dir, "index.md"),
      [
        "# Home",
        "[ok](./setup.md)",
        "[missing](./missng.md)",
        "[bad anchor](./setup.md#instal)",
        "[good anchor](./setup.md#install)",
        "[self](#home)",
        "[web](https://example.com)",
      ].join("\n"),
    );
    await writeFile(join(dir, "sub", "deep.md"), "[up](../index.md)\n");
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("finds Markdown files recursively, sorted", async () => {
    const files = await findMarkdownFiles([dir]);
    assert.equal(files.length, 3);
    assert.deepEqual(files, [...files].sort());
  });

  it("reports ok, broken and skipped links", async () => {
    const results = await checkFile(join(dir, "index.md"));
    assert.deepEqual(
      results.map((r) => r.verdict.status),
      ["ok", "broken", "broken", "ok", "ok", "skipped"],
    );
  });

  it("resolves links relative to the containing file", async () => {
    const results = await checkFile(join(dir, "sub", "deep.md"));
    assert.equal(results[0]?.verdict.status, "ok");
  });
});
```

Run everything:

```bash
npm test
```

## Self-check

You are done when:

- `npm test` passes and `tsc` reports zero errors under `strict`
- the tool runs on its own `docs/` folder and finds the broken link you planted
- `linkcheck` exits `0` on a clean tree, `1` with broken links, `2` on a nonexistent path
- you can explain why `links.ts` has no `import` of `node:fs`

## Stretch goals

1. **Check external URLs** with `fetch` and `AbortSignal.timeout`, using `mapLimit` from lesson 9 to cap concurrency at 8. Cache results per URL.
2. **Case-sensitivity:** on Windows and macOS `README.md` and `readme.md` resolve to the same file; on Linux they don't. Add a case-exact check.
3. **`--fix-anchors` suggestions:** when an anchor is broken, suggest the closest heading using edit distance.
4. **JSON output** with `--format json` for tooling.
5. **Reference-style links:** `[text][ref]` should be flagged if `[ref]:` is never defined.
6. **Parallelise** `checkFile` across files with bounded concurrency, keeping the printed output in a stable order.

## Recap

- You designed with types first: `Link`, `LinkKind` and `Verdict` as small unions.
- Logic is pure and tested; I/O lives in a thin layer; the entry point only wires things together.
- You used generators, regular expressions, async filesystem calls and temporary directories.
- You gave the tool a contract CI can rely on: exit codes `0`, `1`, `2`.

Next level: [Advanced →](../advanced/index.md)
