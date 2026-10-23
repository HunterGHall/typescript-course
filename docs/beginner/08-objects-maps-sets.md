# 8. Objects, Maps & Sets

## What & why

Objects group named values; **Maps** are dictionaries with any kind of key; **Sets** hold unique values. Choosing the right one makes code shorter and faster.

## Object types

An object type lists property names and their types:

```ts
const user: { name: string; age: number; email?: string } = {
  name: "Ada",
  age: 36,
};

user.name;            // string
user.email;           // string | undefined  — the `?` makes it optional
user.age = 37;        // fine: properties are mutable by default
```

Prefer to name the shape so you can reuse it (the next level covers `interface` and `type` in depth):

```ts
type User = {
  readonly id: number;   // cannot be reassigned after creation
  name: string;
  email?: string;
};

const ada: User = { id: 1, name: "Ada" };
// ada.id = 2;            // ERROR: Cannot assign to 'id' because it is a read-only property
```

TypeScript is **structurally typed**: any value with the right shape fits, no matter how it was made. Extra properties are only an error on *fresh object literals*:

```ts
const extra = { id: 2, name: "Bob", admin: true };
const bob: User = extra;                              // OK
const eve: User = { id: 3, name: "Eve", admin: true };// ERROR: object literal may only specify known properties
```

## Reading, adding, removing

```ts
const point = { x: 1, y: 2 };

point.x;                // 1
point["y"];             // 2
"x" in point;           // true
delete (point as { x?: number }).x;   // deleting requires an optional property
```

## Destructuring, spread, shorthand

```ts
const { name, age = 18 } = { name: "Ada" };   // default for missing values
const { name: userName } = ada;               // rename while destructuring

const updated = { ...ada, name: "Ada L." };   // copy and override (later keys win)

const x = 1, y = 2;
const p = { x, y };                           // shorthand for { x: x, y: y }
```

Spread copies are **shallow**, just like arrays.

## Listing keys and values

```ts
const prices = { apple: 1.2, pear: 0.9 };

Object.keys(prices);      // string[]
Object.values(prices);    // number[]
Object.entries(prices);   // [string, number][]
Object.fromEntries([["a", 1], ["b", 2]]);   // { a: 1, b: 2 }
```

Notice `Object.keys` returns `string[]`, not `("apple" | "pear")[]`: objects can have extra keys at runtime, so TypeScript stays safe.

## Records: objects as dictionaries

When keys aren't known in advance, use an **index signature** or `Record`:

```ts
const counts: Record<string, number> = {};
for (const word of ["a", "b", "a"]) {
  counts[word] = (counts[word] ?? 0) + 1;
}
// { a: 2, b: 1 }
```

With `noUncheckedIndexedAccess`, `counts[word]` is `number | undefined`, which is why `?? 0` is needed. Good: the type tells the truth.

`Record` with a union of literals requires every key:

```ts
type Level = "low" | "high";
const limits: Record<Level, number> = { low: 1, high: 10 };   // both keys required
```

## `Map`: a better dictionary

A plain object only has string/symbol keys and inherits things like `toString`. A `Map` has none of those problems:

```ts
const ages = new Map<string, number>();
ages.set("ada", 36);
ages.set("bob", 41);

ages.get("ada");        // 36
ages.get("zed");        // undefined
ages.has("bob");        // true
ages.delete("bob");
ages.size;              // 1

for (const [name, age] of ages) {
  console.log(name, age);
}
```

Maps remember insertion order, accept **any** key type (objects, numbers, ...), and are efficient for frequent additions and removals. Counting idiom:

```ts
const freq = new Map<string, number>();
for (const w of "to be or not to be".split(" ")) {
  freq.set(w, (freq.get(w) ?? 0) + 1);
}
```

Node 22 and newer add `Object.groupBy` / `Map.groupBy`. (To let the compiler know about them, add `"lib": ["ES2024"]` to `tsconfig.json`.)

```ts
const byLength = Object.groupBy(["a", "bb", "cc", "d"], (w) => w.length);
// { 1: ["a", "d"], 2: ["bb", "cc"] }
```

**Object or Map?** Use an object (or `type`) for a fixed, known set of fields — a *record* of data. Use a `Map` for a dynamic collection keyed by arbitrary values.

## `Set`: unique values

```ts
const seen = new Set<number>([1, 2, 2, 3]);
seen.add(4);
seen.has(2);        // true
seen.size;          // 4  — duplicates were ignored
[...seen];          // [1, 2, 3, 4]

const unique = [...new Set(["a", "b", "a"])];   // ["a", "b"]
```

Set algebra (Node 22+; add `"ESNext.Collection"` to `lib` so the compiler knows these methods):

```ts
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);
a.union(b);          // {1,2,3,4}
a.intersection(b);   // {2,3}
a.difference(b);     // {1}
a.isSubsetOf(b);     // false
```

## Equality caveat

Maps and Sets compare keys with "same value zero" semantics: primitives by value, **objects by identity**:

```ts
const s = new Set([{ id: 1 }]);
s.has({ id: 1 });   // false — a different object
```

Key by a primitive (`id`) when you want content-based lookup.

## `WeakMap` / `WeakSet` (brief)

Keys must be objects and don't prevent garbage collection. Use them to attach metadata to objects you don't own, without leaking memory.

## Common mistakes

- **Using `{}` as a dictionary with user-supplied keys** (`"__proto__"`, `"constructor"`). Use a `Map`.
- **Expecting `Object.keys` to return narrow key types.**
- **Forgetting spread is shallow.**
- **Using objects as `Map`/`Set` keys** and expecting content equality.
- **Mutating an object you also gave to someone else.** Copy with spread when in doubt.
- **Using `for...in`** instead of `Object.entries`.

## Exercises

1. Write a function that counts letter frequencies in a string and prints them sorted from most to least common (use a `Map`).
2. Given `[{name, city}]`, group names by city with `Map` or `Object.groupBy`.
3. Remove duplicates from `[3, 1, 3, 2, 1]`, preserving first-seen order.
4. Define `type Config` with required and optional fields and a `readonly` field; create one and try to break each rule.
5. Merge two settings objects so the second overrides the first, without mutating either.
6. Find the words that appear in both of two sentences using `Set.intersection`.

## Recap

- Objects model fixed shapes; `readonly` and `?` refine them. Typing is structural.
- Destructuring and spread (shallow!) make working with objects pleasant.
- `Record<string, T>` or an index signature for open dictionaries; a `Map` is safer and more flexible.
- `Set` keeps unique values and supports union/intersection/difference.
- Objects as keys compare by identity.

Next: [Functions →](09-functions.md)
