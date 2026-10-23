# 10. JSON & runtime validation

## What & why

TypeScript's types vanish when the program runs. The compiler can prove your *own* code consistent, but it cannot see the contents of a file, a network response, an environment variable or user input. If you write `JSON.parse(text) as User`, you are not checking anything — you're **lying to the compiler**, and the lie surfaces later as `undefined is not a function`.

The boundary between the typed inside of your program and the untyped outside world needs **runtime validation**. This lesson shows the tools, and the most important idea in practical TypeScript: *parse, don't assume*.

## JSON basics

```ts
const text = JSON.stringify({ name: "Ada", tags: ["a", "b"] });           // '{"name":"Ada","tags":["a","b"]}'
const pretty = JSON.stringify({ n: 1 }, null, 2);                          // indented
const data = JSON.parse(text);                                             // any!
```

`JSON.parse` returns `any`. Immediately give it an honest type:

```ts
const data: unknown = JSON.parse(text);
```

`JSON.parse` throws `SyntaxError` on invalid JSON; catch it.

What JSON can't represent: `undefined`, functions, `Date` (becomes a string), `Map`/`Set` (become `{}`), `NaN`/`Infinity` (become `null`), `bigint` (throws), cyclic references (throws). Plan conversions for these:

```ts
JSON.stringify({ when: new Date(0) });     // '{"when":"1970-01-01T00:00:00.000Z"}' — a string on the way back
```

## Hand-written guards

A **type guard** is a function that checks at runtime and tells the compiler the result:

```ts
interface User {
  id: number;
  name: string;
  email?: string;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isUser(x: unknown): x is User {
  return (
    isRecord(x) &&
    typeof x["id"] === "number" &&
    typeof x["name"] === "string" &&
    (x["email"] === undefined || typeof x["email"] === "string")
  );
}

const raw: unknown = JSON.parse('{"id":1,"name":"Ada"}');
if (isUser(raw)) {
  console.log(raw.name.toUpperCase());      // safe: checked
} else {
  throw new Error("Invalid user");
}
```

This works, and it's honest, but two problems show up quickly: it's verbose, and the `User` interface and the guard are **two copies** of the same fact. Add a field to one and forget the other and the guard lies.

## Parsers that report why

A guard answers yes/no. A **parser** returns the typed value or a useful error:

```ts
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseUser(x: unknown): Parsed<User> {
  if (!isRecord(x)) return { ok: false, error: "expected an object" };
  const { id, name, email } = x;
  if (typeof id !== "number") return { ok: false, error: "id must be a number" };
  if (typeof name !== "string") return { ok: false, error: "name must be a string" };
  if (email !== undefined && typeof email !== "string")
    return { ok: false, error: "email must be a string" };
  return { ok: true, value: email === undefined ? { id, name } : { id, name, email } };
}
```

Better messages, and the parser can also *transform*: trim strings, convert date strings to `Date`, apply defaults. Parsing produces a new, trustworthy value.

## One source of truth: schemas

The cure for duplication is a **schema**: describe the shape once, as a runtime value, and **derive the type from it**. Libraries such as **Zod**, Valibot, ArkType and Effect Schema do this. With Zod:

```bash
npm install zod
```

```ts
import { z } from "zod";

const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(["admin", "member"]).default("member"),
  createdAt: z.coerce.date(),               // accepts an ISO string, yields a Date
});

type User = z.infer<typeof UserSchema>;     // derived — can never drift

const result = UserSchema.safeParse(JSON.parse(text));
if (result.success) {
  const user: User = result.data;
} else {
  console.error(result.error.issues);       // path + message for every problem
}
```

The schema is both the validator and the type. Use `.parse()` to throw on invalid input, `.safeParse()` to get a result object.

You don't need a library to follow the idea, and for tiny cases hand-written guards are fine. But once a boundary has more than a handful of fields, a schema pays for itself.

## Where to validate

Validate at **every boundary where data enters** your program:

- `JSON.parse` of files and API responses
- `process.env` (each entry is `string | undefined`)
- command-line arguments
- HTTP request bodies, query strings
- database rows, message queue payloads
- `localStorage` and anything a user can edit

Inside the boundary, pass around trusted, typed values and don't re-validate.

### Configuration example

```ts
const Env = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
});

export const env = Env.parse(process.env);     // crashes at startup with a clear message — good!
```

Failing fast at startup with a precise message beats a mysterious failure an hour later.

## Reading and writing JSON files

```ts
import { readFile, writeFile } from "node:fs/promises";

async function loadUsers(path: string): Promise<User[]> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  return z.array(UserSchema).parse(raw);
}

async function saveUsers(path: string, users: User[]): Promise<void> {
  await writeFile(path, JSON.stringify(users, null, 2) + "\n");
}
```

For writes, serialization from a trusted typed value is safe, but think about the shape you are committing to: files outlive the code that wrote them. Add a `"version": 1` field when the format may change.

## Dates, bigints and Maps

```ts
JSON.stringify(new Map([["a", 1]]));                 // "{}"  — silently lossy!
JSON.stringify([...new Map([["a", 1]])]);            // '[["a",1]]'   — convert first
```

Use `toJSON()` on classes, or a `replacer`/`reviver` function for custom handling:

```ts
JSON.stringify({ n: 10n }, (_, v) => (typeof v === "bigint" ? v.toString() : v));
```

## Excess and missing fields

Decide what a parser does with unexpected input:

- **Strip** unknown keys (Zod's default for objects),
- **reject** them (`.strict()`), or
- **keep** them (`.passthrough()`).

For public APIs, rejecting or stripping avoids accidentally trusting fields you never intended to read.

## Security note

Never `eval` JSON. Never build objects by merging parsed JSON into existing objects without checking for `__proto__` keys (prototype pollution). Parse into fresh, validated objects.

## Common mistakes

- **`JSON.parse(x) as T`.** An assertion isn't validation.
- **Keeping a hand-written type and a hand-written check** that drift apart.
- **Trusting `process.env`** values to be numbers or even present.
- **Forgetting JSON's limits** (`Date`, `Map`, `undefined`, `bigint`).
- **Validating deep inside the program** instead of at the boundary.
- **Swallowing validation errors** or surfacing them with no path/message.

## Exercises

1. Write `isUser` for a `User` with an `id`, `name` and optional `tags: string[]`, and test it with five good and five bad inputs.
2. Turn that guard into a `parseUser` that returns a helpful error string for each failure.
3. Write a `loadConfig(path)` for a JSON config with defaults, using only hand-written code. List what annoyed you.
4. Rewrite it with Zod (or another schema library) and compare the line counts.
5. Parse `process.env` into a typed config object and make the program exit with a clear message if something is missing.
6. Show a `Date` surviving a JSON round-trip incorrectly, then fix it with a schema transform or reviver.

## Recap

- Types are erased; data from outside is `unknown` until proven otherwise.
- `as` is not validation. Guards and parsers check at runtime.
- A schema defines validator and type together (`z.infer`), eliminating drift.
- Validate at every boundary, then trust the typed value inside.
- JSON loses `Date`, `Map`, `Set`, `undefined` and `bigint`; plan the conversions.

Next: [Testing →](11-testing.md)
