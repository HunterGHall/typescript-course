# 12. Capstone: task tracker

## Goal

Build a command-line to-do list that remembers your tasks between runs. It uses everything from this level: variables and types, strings, arrays, objects, functions, narrowing, file I/O and error handling.

The finished source is in [`capstones/task-tracker`](https://github.com/HunterGHall/typescript-course/tree/main/capstones/task-tracker) and is built by CI. Try to write it yourself first, then compare.

## What it does

```
$ tasks add "Buy milk"
Added: Buy milk
$ tasks add "Learn TypeScript"
Added: Learn TypeScript
$ tasks done 2
Completed: Learn TypeScript
$ tasks list
1. [ ] Buy milk
2. [x] Learn TypeScript
$ tasks remove 9
No such task: 9
$ echo $?
1
```

## Requirements

1. Four commands: `add <title...>`, `list`, `done <number>`, `remove <number>`.
2. Tasks are numbered from **1** when listed, but stored in an array (0-based). Convert carefully.
3. Tasks persist in a text file, one per line: `[ ] title` or `[x] title`. The file path comes from the `TASKS_FILE` environment variable, defaulting to `tasks.txt`.
4. A missing file means "no tasks yet", not an error.
5. Bad input (unknown command, missing title, number out of range or not a number) prints a message to **stderr** and exits with code `1`.

## Project setup

```bash
mkdir tasks && cd tasks
npm init -y
npm install --save-dev typescript @types/node
npx tsc --init          # then use the settings from lesson 1
mkdir src
```

Add `"type": "module"` and a build script to `package.json`:

```json
{
  "type": "module",
  "scripts": { "build": "tsc" }
}
```

Run it with `npm run build && node dist/main.js list`.

## Step 1: the data model

A task is two facts. Name them:

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface Task {
  title: string;
  done: boolean;
}

const file = process.env["TASKS_FILE"] ?? "tasks.txt";
```

`process.env[...]` is `string | undefined`, so `??` supplies the default.

## Step 2: loading and saving

Keep the file format knowledge in exactly two functions:

```ts
function load(): Task[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => ({ done: line.startsWith("[x] "), title: line.slice(4) }));
}

function save(tasks: Task[]): void {
  const text = tasks.map((t) => `${t.done ? "[x]" : "[ ]"} ${t.title}`).join("\n");
  writeFileSync(file, text === "" ? "" : text + "\n");
}
```

Notice `split` → `filter` → `map` as a pipeline, and how the empty list is handled in `save` (otherwise you'd write a lone newline).

## Step 3: failing cleanly

Every error path does the same thing, so write it once. Its return type is `never`: the compiler then knows nothing after a call to `fail` runs, which helps narrowing.

```ts
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
```

Converting a user-typed task number into an array index is the trickiest bit, so isolate it:

```ts
/** Parses a 1-based task number and checks it is in range. */
function parseIndex(text: string | undefined, count: number): number {
  const n = Number(text);
  if (text === undefined || !Number.isInteger(n) || n < 1 || n > count) {
    fail(`No such task: ${text ?? "(missing)"}`);
  }
  return n - 1;
}
```

Check each condition: `undefined` (no argument), non-integers such as `"abc"` (`NaN`) or `"1.5"`, and out of range. Because `fail` returns `never`, TypeScript knows `n` is valid on the last line.

## Step 4: the commands

```ts
const [command, ...args] = process.argv.slice(2);
const tasks = load();

switch (command) {
  case "add": {
    const title = args.join(" ").trim();
    if (title === "") fail("Usage: tasks add <title>");
    tasks.push({ title, done: false });
    save(tasks);
    console.log(`Added: ${title}`);
    break;
  }
  case "list": {
    if (tasks.length === 0) console.log("No tasks yet.");
    tasks.forEach((t, i) => console.log(`${i + 1}. [${t.done ? "x" : " "}] ${t.title}`));
    break;
  }
  case "done": {
    const i = parseIndex(args[0], tasks.length);
    tasks[i]!.done = true;
    save(tasks);
    console.log(`Completed: ${tasks[i]!.title}`);
    break;
  }
  case "remove": {
    const i = parseIndex(args[0], tasks.length);
    const [removed] = tasks.splice(i, 1);
    save(tasks);
    console.log(`Removed: ${removed!.title}`);
    break;
  }
  default:
    fail("Usage: tasks <add|list|done|remove> [args]");
}
```

Two details worth studying:

- The `!` after `tasks[i]` is justified: `parseIndex` has *proved* the index is in range. This is the "provably impossible" case from lesson 10.
- Each `case` has its own braces, so `const` declarations don't leak between cases.

## Run it

```bash
npm run build
export TASKS_FILE=/tmp/demo.txt     # PowerShell: $env:TASKS_FILE = "$env:TEMP\demo.txt"
node dist/main.js add Buy milk
node dist/main.js add Learn TypeScript
node dist/main.js done 2
node dist/main.js list
node dist/main.js remove 9; echo $?     # prints the error, then 1
```

## Self-check

You are done when:

- all four commands work and survive between runs
- every bad input exits with `1` and a message on stderr
- `npx tsc` reports zero errors under `strict`
- you can explain why `parseIndex` returns `n - 1`, and what `never` is doing in `fail`

## Stretch goals

1. Add `clear-done`, which removes every completed task.
2. Add `edit <number> <new title...>`.
3. Make `list` accept `--pending` / `--done` filters (use `process.argv` or `util.parseArgs` from `node:util`).
4. Store tasks as JSON instead of the line format; handle a corrupt file with a friendly message.
5. Add a `due` date to each task and sort `list` by it. Which of your functions had to change?
6. Move `load`/`save`/`parseIndex` into their own module and import them. (This previews Intermediate lesson 7.)

## Recap

- You modelled data with an interface, kept I/O in two functions, and reported errors in one place.
- `never` plus narrowing let the compiler trust validated input.
- You used `node:fs`, `process.argv`, `process.env`, exit codes and stderr: the building blocks of every Node CLI.

Next level: [Intermediate →](../intermediate/index.md)
