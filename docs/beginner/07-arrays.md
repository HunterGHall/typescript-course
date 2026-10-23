# 7. Arrays & tuples

## What & why

An **array** is an ordered, growable list of values. A **tuple** is a fixed-length array where each position has its own type. Between them they cover most "list of things" needs.

## Typing arrays

Two equivalent spellings; the first is more common:

```ts
const scores: number[] = [90, 85, 72];
const names: Array<string> = ["Ada", "Grace"];
const mixed: (number | string)[] = [1, "two", 3];   // parentheses matter
const empty: string[] = [];                          // annotate empty arrays
```

An empty literal `[]` with no annotation infers as `never[]` in some contexts, which is useless — annotate it.

## Reading and changing

```ts
const nums = [10, 20, 30];

nums[0];            // 10  (typed number | undefined with noUncheckedIndexedAccess)
nums.at(-1);        // 30  — last element; always number | undefined
nums.length;        // 3

nums.push(40);          // add to the end
nums.pop();             // remove from the end
nums.unshift(0);        // add to the start (slow on big arrays)
nums.shift();           // remove from the start
nums.splice(1, 1);      // remove 1 item at index 1 (mutates)
```

`push`, `pop`, `splice`, `sort` and `reverse` **mutate** the array. Many newer methods return a copy instead: `toSorted`, `toReversed`, `toSpliced`, `with`.

```ts
const sorted = nums.toSorted((a, b) => a - b);   // new array, nums untouched
const changed = nums.with(0, 99);                // copy with index 0 replaced
```

## Slicing and combining

```ts
const letters = ["a", "b", "c", "d", "e"];

letters.slice(1, 3);      // ["b", "c"]   — end is exclusive
letters.slice(-2);        // ["d", "e"]
[...letters, "f"];        // spread: copy and extend
letters.concat(["x"]);    // same idea
```

## The big three: `map`, `filter`, `reduce`

```ts
const prices = [5, 12, 8, 20];

const withTax = prices.map((p) => p * 1.2);              // transform each
const cheap = prices.filter((p) => p < 10);              // keep some
const total = prices.reduce((sum, p) => sum + p, 0);     // fold to one value
```

Chain them:

```ts
const result = prices
  .filter((p) => p >= 8)
  .map((p) => p * 2)
  .reduce((a, b) => a + b, 0);
```

TypeScript infers every intermediate type. Hover to check.

## Searching and testing

```ts
const people = [
  { name: "Ada", age: 36 },
  { name: "Bob", age: 17 },
];

people.find((p) => p.age < 18);        // { name: "Bob", age: 17 } | undefined
people.findIndex((p) => p.age < 18);   // 1 (-1 if none)
people.some((p) => p.age >= 18);       // true
people.every((p) => p.age >= 18);      // false
[1, 2, 3].includes(2);                 // true
```

## Sorting

The default `sort()` converts items to **strings**:

```ts
[10, 9, 1].sort();                 // [1, 10, 9]  — alphabetical!
[10, 9, 1].sort((a, b) => a - b);  // [1, 9, 10]
```

Always pass a comparator for numbers. For text, `a.localeCompare(b)`. For objects, compare a field:

```ts
people.toSorted((a, b) => a.name.localeCompare(b.name));
```

A comparator returns negative (a first), zero (equal) or positive (b first).

## Destructuring and spread

```ts
const [first, second, ...rest] = [1, 2, 3, 4];
// first = 1, second = 2, rest = [3, 4]

let a = 1, b = 2;
[a, b] = [b, a];       // swap
```

## `readonly` arrays

When a function shouldn't change its input, say so; callers can then pass either kind of array:

```ts
function total(values: readonly number[]): number {
  // values.push(1);   // ERROR: Property 'push' does not exist on type 'readonly number[]'
  return values.reduce((a, b) => a + b, 0);
}
```

## Copies are shallow

`[...arr]`, `slice()` and `Array.from(arr)` copy only the top level. Objects inside are shared:

```ts
const original = [{ n: 1 }];
const copy = [...original];
copy[0]!.n = 99;
console.log(original[0]!.n);        // 99 — same inner object

const deep = structuredClone(original);   // a true deep copy
```

(The `!` is a non-null assertion; lesson 10 explains why to use it sparingly.)

## Tuples

A tuple has a fixed length with a type per position:

```ts
const point: [number, number] = [3, 4];
const entry: [string, number] = ["age", 36];
const [x, y] = point;

// point[2];                // ERROR: Tuple type '[number, number]' of length '2' has no element at index '2'
```

Optional and labelled elements make them self-documenting:

```ts
type Range = [start: number, end: number, step?: number];
const r: Range = [0, 10];
```

Tuples shine for returning two or three related values from a function:

```ts
function minMax(values: number[]): [min: number, max: number] {
  return [Math.min(...values), Math.max(...values)];
}
const [lo, hi] = minMax([4, 1, 9]);
```

If a tuple grows past about three fields, use an object with named properties instead.

`as const` freezes a literal into a readonly tuple of literal types:

```ts
const origin = [0, 0] as const;     // readonly [0, 0]
```

## Common mistakes

- **Sorting numbers without a comparator.**
- **Mutating the array you're looping over.**
- **Assuming `arr[i]` is always defined.** It isn't if `i` is out of range.
- **Believing a copy is independent** when elements are objects.
- **Using `==`/`===` to compare arrays.** Compare lengths and elements, or compare `JSON.stringify` for simple data.
- **Forgetting `reduce`'s initial value,** which makes empty arrays throw.
- **Annotating `string | number[]`** when you meant `(string | number)[]`.

## Exercises

1. Given `[3, 1, 4, 1, 5, 9, 2, 6]`, produce: the sorted array (without mutating), the sum, the max, and the array with duplicates removed (`new Set` is a hint).
2. Write `chunk<T>(items: T[], size: number): T[][]`, which splits a list into groups (the `<T>` is a generic; Intermediate lesson 4 explains it, for now copy the signature). Test with 7 items and size 3.
3. Given an array of `{ name, age }` objects, produce a list of names of everyone 18 or over, sorted alphabetically.
4. Write `minMax` returning a tuple; destructure the result.
5. Rotate an array left by `k` positions without mutating it.
6. Show with an example why `[...arr]` is not a deep copy, and fix it.

## Recap

- `T[]` for lists; `readonly T[]` for inputs you won't change.
- `map`/`filter`/`reduce`/`find`/`some`/`every` express intent; prefer non-mutating methods like `toSorted`.
- `sort()` needs a comparator for numbers.
- Copies are shallow; `structuredClone` is deep.
- Tuples give each position its own type: ideal for small fixed-shape results.

Next: [Objects, Maps & Sets →](08-objects-maps-sets.md)
