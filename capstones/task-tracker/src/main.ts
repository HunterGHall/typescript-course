import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface Task {
  title: string;
  done: boolean;
}

const file = process.env["TASKS_FILE"] ?? "tasks.txt";

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

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Parses a 1-based task number and checks it is in range. */
function parseIndex(text: string | undefined, count: number): number {
  const n = Number(text);
  if (text === undefined || !Number.isInteger(n) || n < 1 || n > count) {
    fail(`No such task: ${text ?? "(missing)"}`);
  }
  return n - 1;
}

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
