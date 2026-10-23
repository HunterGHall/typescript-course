# 5. Utility types

## What & why

You'll often need a type that is *almost* an existing one: all fields optional, just two of the fields, the return type of a function. Rewriting these by hand creates copies that drift out of sync. TypeScript ships **utility types** that derive new types from old ones, so there is one source of truth.

We'll use this model throughout:

```ts
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: Date;
}
```

## Making fields optional or required

```ts
type UserPatch = Partial<User>;
// { id?: number; name?: string; ... }  — every field optional

type FullUser = Required<Partial<User>>;   // every field required again

function updateUser(user: User, patch: Partial<User>): User {
  return { ...user, ...patch };
}

updateUser(ada, { name: "Ada L." });        // only what changes
```

`Partial` is the type of "update" and "options" arguments.

## `Readonly`

```ts
const frozen: Readonly<User> = ada;
// frozen.name = "x";                  // ERROR
```

Shallow only: nested objects remain mutable.

## Picking and omitting fields

```ts
type UserPreview = Pick<User, "id" | "name">;
// { id: number; name: string }

type NewUser = Omit<User, "id" | "createdAt">;
// everything except id and createdAt — what a client submits when creating a user

function create(input: NewUser): User {
  return { ...input, id: Math.random(), createdAt: new Date() };
}
```

If you rename `email` later, `Pick<User, "email">` becomes a compile error instead of silently going stale.

## `Record`

```ts
type RoleCounts = Record<User["role"], number>;     // { admin: number; member: number }
const counts: RoleCounts = { admin: 1, member: 10 };

const byId: Record<number, User> = {};
```

With a union of literals as keys, `Record` requires every key: a built-in exhaustiveness check.

## Filtering unions: `Exclude`, `Extract`, `NonNullable`

These operate on **union** members:

```ts
type Status = "idle" | "loading" | "done" | "error";

type Active = Exclude<Status, "idle">;          // "loading" | "done" | "error"
type Finished = Extract<Status, "done" | "error">;  // "done" | "error"
type Defined = NonNullable<string | null | undefined>;   // string
```

## Function utility types

```ts
function connect(host: string, port: number) {
  return { host, port, connected: true };
}

type Conn = ReturnType<typeof connect>;           // { host: string; port: number; connected: boolean }
type ConnArgs = Parameters<typeof connect>;       // [host: string, port: number]
type FirstArg = Parameters<typeof connect>[0];    // string
```

`typeof connect` takes the **type of a value** (a function here). `ReturnType` and `Parameters` then read it. Derive types from the code that exists rather than restating them.

```ts
type Ctor = new (name: string) => User;
type Instance = InstanceType<Ctor>;               // User
```

## `Awaited`

Unwraps Promises, recursively:

```ts
type A = Awaited<Promise<string>>;                // string
type B = Awaited<Promise<Promise<number>>>;       // number

async function load() {
  return { users: [] as User[] };
}
type Loaded = Awaited<ReturnType<typeof load>>;   // { users: User[] }
```

## Indexed access, `keyof`, `typeof`

The building blocks that utility types themselves use:

```ts
type Role = User["role"];                          // "admin" | "member"
type UserKey = keyof User;                         // "id" | "name" | "email" | "role" | "createdAt"
type NameOrEmail = User["name" | "email"];         // string

const defaults = { retries: 3, verbose: false };
type Defaults = typeof defaults;                   // { retries: number; verbose: boolean }

const ROUTES = ["home", "about"] as const;
type Route = (typeof ROUTES)[number];              // "home" | "about"
```

Array element type: `T[number]`. Tuple element: `T[0]`.

## Combining utilities

They compose. Update payloads often look like "everything optional except the id":

```ts
type UpdateUser = Partial<Omit<User, "id">> & Pick<User, "id">;
```

Make a reusable helper with a generic:

```ts
type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

type UserWithEmail = WithRequired<Partial<User>, "email">;
```

(The `[P in K]-?: ...` syntax is a *mapped type*; the Advanced level explains it fully.)

## Choosing between `Omit` and `Pick`

Use `Pick` when you want a **small, explicit** subset (safe against new fields leaking in). Use `Omit` when you want **almost everything** and are happy for new fields to flow through. For public API shapes, `Pick` is the safer default.

Note that `Omit<T, K>` doesn't check that `K` is actually a key of `T`, so typos pass silently. A stricter version:

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

## `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`

String-literal utilities:

```ts
type Loud = Uppercase<"hello">;                    // "HELLO"
type Handler = `on${Capitalize<"click" | "focus">}`;   // "onClick" | "onFocus"
```

## Common mistakes

- **Handwriting a near-copy of a type** instead of deriving it.
- **Expecting `Partial`/`Readonly` to be deep.** They aren't.
- **Using `Omit` on a union type;** it collapses the union. Use a distributive helper or `Exclude` per variant.
- **Forgetting `typeof`** when you want the type of a value: `ReturnType<connect>` is an error; use `ReturnType<typeof connect>`.
- **Typos in `Omit` keys** that silently do nothing.
- **Reaching for `Record<string, any>`** when `Record<string, unknown>` or a real shape works.

## Exercises

1. Given `User`, write types for: a public profile (name + role), a create payload, and an update payload.
2. Derive `type Handler = (event: string) => void` from a function that already exists, using `Parameters` and `ReturnType`.
3. Given `const COLORS = ["red", "green", "blue"] as const`, derive the union and a `Record<Color, number>` of counts.
4. Use `Awaited` and `ReturnType` to get the resolved type of `fetchUsers()`.
5. Write `type Mutable<T> = { -readonly [K in keyof T]: T[K] }` and test it on a readonly interface. (A preview of mapped types.)
6. Show a bug that `Omit` with a misspelled key hides, then fix it with `StrictOmit`.

## Recap

- Utility types derive new types from existing ones: one source of truth.
- `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record` reshape objects.
- `Exclude`, `Extract`, `NonNullable` filter unions.
- `ReturnType`, `Parameters`, `InstanceType`, `Awaited` read function and promise types.
- `typeof`, `keyof` and indexed access `T[K]` are the primitives underneath.

Next: [Closures & higher-order functions →](06-closures.md)
