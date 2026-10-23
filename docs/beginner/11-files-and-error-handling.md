# 11. Files & error handling

## What & why

Real programs read and write files, and real I/O fails: the file doesn't exist, the disk is full, the user typed a bad path. TypeScript (via JavaScript) handles failure with **exceptions**: code `throw`s, and a surrounding `try`/`catch` decides what to do. This lesson covers both halves, because file I/O is where you meet errors first.

## `try`, `catch`, `finally`

```ts
try {
  const data = JSON.parse("not json");
  console.log(data);
} catch (error) {
  console.log("Could not parse:", error);
} finally {
  console.log("runs whether or not it failed");
}
```

If anything inside `try` throws, execution jumps to `catch`. `finally` always runs — ideal for cleanup.

## What `catch` gives you: `unknown`

Anything can be thrown in JavaScript — strings, numbers, objects. So under `strict`, the caught variable is **`unknown`** (`useUnknownInCatchVariables`), and you must check before use:

```ts
try {
  riskyThing();
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Non-Error thrown:", error);
  }
}
```

A tiny helper saves repetition:

```ts
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

## Throwing errors

Always throw `Error` objects (not strings): they carry a stack trace.

```ts
function parseAge(text: string): number {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid age: "${text}"`);
  }
  return n;
}

try {
  parseAge("-3");
} catch (error) {
  console.error(messageOf(error));   // Invalid age: "-3"
}
```

Your own error types (a class extending `Error`) are covered in the Intermediate level.

## Reading and writing files

Node's `node:fs` module has synchronous and promise-based forms. For small scripts, the synchronous ones are the simplest:

```ts
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

writeFileSync("notes.txt", "first line\n");           // create/overwrite
appendFileSync("notes.txt", "second line\n");         // add to the end

if (existsSync("notes.txt")) {
  const text = readFileSync("notes.txt", "utf8");     // always pass the encoding, or you get a Buffer
  const lines = text.split("\n").filter((l) => l !== "");
  console.log(lines);                                 // ["first line", "second line"]
}
```

For programs that do other work while waiting on the disk, use the promise API (you'll understand `await` fully in Intermediate lesson 9):

```ts
import { readFile, writeFile } from "node:fs/promises";

await writeFile("data.json", JSON.stringify({ n: 1 }));
const text = await readFile("data.json", "utf8");
```

### Handling a missing file

Rather than checking `existsSync` first (the file could vanish in between), try and handle the specific error:

```ts
function readOrEmpty(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";                                      // file doesn't exist: treat as empty
    }
    throw error;                                      // anything else is a real problem
  }
}
```

Rethrow what you can't handle. Swallowing every error hides bugs.

## Paths

Never build paths by gluing strings together; Windows and POSIX differ. Use `node:path`:

```ts
import { basename, dirname, extname, join, resolve } from "node:path";

join("data", "users", "ada.json");     // "data/users/ada.json" (backslashes on Windows)
resolve("data", "ada.json");           // absolute path from the current directory
basename("/a/b/report.pdf");           // "report.pdf"
extname("report.pdf");                 // ".pdf"
dirname("/a/b/report.pdf");            // "/a/b"
```

In an ES module, the directory of the current file comes from `import.meta`:

```ts
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
// or, on Node 20.11+: import.meta.dirname
```

## Directories

```ts
import { mkdirSync, readdirSync, statSync } from "node:fs";

mkdirSync("out/reports", { recursive: true });        // creates parents; fine if it exists

for (const name of readdirSync("src")) {
  const info = statSync(join("src", name));
  console.log(name, info.isDirectory() ? "dir" : `${info.size} bytes`);
}
```

## Command-line arguments and exit codes

```ts
const [command, ...rest] = process.argv.slice(2);

if (command === undefined) {
  console.error("Usage: tool <command> [args]");
  process.exit(1);                                     // non-zero = failure
}
```

Convention: exit code `0` means success, non-zero means failure. Write error messages to `console.error` (stderr), results to `console.log` (stdout), so output can be piped without mixing.

Environment variables are in `process.env`; each is `string | undefined`:

```ts
const file = process.env["TASKS_FILE"] ?? "tasks.txt";
```

## A persistence pattern

Load → modify → save, with a small file format:

```ts
interface Note { text: string; done: boolean }

function load(path: string): Note[] {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as Note[];   // trusting the file; Intermediate lesson 10 fixes this
}

function save(path: string, notes: Note[]): void {
  writeFileSync(path, JSON.stringify(notes, null, 2));
}
```

## Common mistakes

- **Reading without an encoding** and wondering why you got a `<Buffer ...>`.
- **Catching an error and ignoring it** (`catch {}`) — you lose the cause.
- **Throwing strings** instead of `Error` objects.
- **Assuming `error.message` exists** on an `unknown` value.
- **Hard-coding `/` or `\`** in paths.
- **Check-then-use races** (`existsSync` then `readFileSync`): just try and catch.
- **Printing errors to stdout,** which pollutes piped output.

## Exercises

1. Write a program that takes a file path argument, prints how many lines and words it contains, and prints a friendly error (exit code 1) if it can't be read.
2. Write `readJson(path)` that returns `undefined` for a missing file, but rethrows for any other error.
3. Append a timestamped line to `log.txt` each time the program runs. Run it three times.
4. List all `.ts` files in a directory (non-recursive) with their sizes.
5. Write `parsePositiveInt(text)` that throws a descriptive `Error`, and a caller that catches and reports it using `messageOf`.
6. Add a `finally` that prints "done" and verify it runs on both success and failure.

## Recap

- `try`/`catch`/`finally`; `catch` gives you `unknown`, so narrow before use.
- Throw `Error` objects; rethrow what you can't handle.
- `node:fs` for files (sync for scripts, promises for concurrency), `node:path` for portable paths.
- Exit code `0` = success; errors to stderr.
- Prefer try-and-handle over check-then-use.

Next: [Capstone: task tracker →](12-capstone-task-tracker.md)
