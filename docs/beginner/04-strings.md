# 4. Strings

## What & why

A `string` is an immutable sequence of text. Almost every program builds, splits, searches and formats strings, so it pays to know the toolbox — and the two or three surprises (Unicode and immutability).

## Writing strings

```ts
const a = "double quotes";
const b = 'single quotes';
const c = `backticks (a template literal)`;
```

Backticks are the powerful form: they interpolate expressions and span lines.

```ts
const name = "Ada";
const items = 3;
console.log(`Hello, ${name}! You have ${items} item${items === 1 ? "" : "s"}.`);

const poem = `Roses are red,
Violets are blue`;
```

Escapes: `\n` newline, `\t` tab, `\\` backslash, `\"` quote, `\u{1F600}` Unicode code point.

## Common methods

```ts
const s = "  Hello, TypeScript  ";

s.length;                    // 22
s.trim();                    // "Hello, TypeScript"
s.toUpperCase();             // "  HELLO, TYPESCRIPT  "
s.toLowerCase();
s.includes("Type");          // true
s.startsWith("  He");        // true
s.endsWith("pt  ");          // true
s.indexOf("T");              // 9   (-1 if absent)
s.slice(2, 7);               // "Hello"
s.replace("Hello", "Bye");   // replaces the first match only
s.replaceAll("l", "L");      // replaces every match
"a,b,c".split(",");          // ["a", "b", "c"]
["a", "b"].join("-");        // "a-b"
"ab".repeat(3);              // "ababab"
"7".padStart(3, "0");        // "007"
"x".padEnd(3, ".");          // "x.."
```

**Strings are immutable.** Every method returns a *new* string; the original never changes:

```ts
const t = "hello";
t.toUpperCase();
console.log(t);   // still "hello"
```

## Indexing

```ts
const word = "TypeScript";
word[0];          // "T"
word.at(-1);      // "t"   — negative index counts from the end
word[99];         // undefined at runtime (typed as string, unless noUncheckedIndexedAccess is on)
word.charAt(99);  // ""
```

With `noUncheckedIndexedAccess` enabled (as in this course), `word[0]` has type `string | undefined`, which is honest: the index might be out of range.

## Comparing

```ts
"a" === "a";                 // true — compares contents
"apple" < "banana";          // true — by UTF-16 code unit
"a".localeCompare("b");      // -1  — locale-aware, use this to sort text
"a".localeCompare("A", undefined, { sensitivity: "base" });   // 0 — ignore case
```

Always `===`, never `==`.

## Unicode: what `length` really counts

JavaScript strings are UTF-16. `length` counts **code units**, not characters a human sees:

```ts
"é".length;        // 1  (or 2 if written as e + combining accent!)
"😀".length;       // 2  — one emoji, two code units
[..."😀"].length;  // 1  — iterating a string walks code points
```

To count what a user perceives as characters, use `Intl.Segmenter`:

```ts
const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
console.log([...seg.segment("👨‍👩‍👧")].length);   // 1
```

Normalise before comparing text from different sources: `a.normalize() === b.normalize()`.

## Splitting and joining text

```ts
const csv = "ada,36,London";
const [name, age, city] = csv.split(",");
// with noUncheckedIndexedAccess each is `string | undefined` — handle that

const words = "the quick  brown fox".split(/\s+/);   // regex split: ["the","quick","brown","fox"]
const sentence = words.join(" ");
```

## Regular expressions in a nutshell

```ts
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
email.test("ada@example.com");           // true

"2026-10-23".match(/(\d+)-(\d+)-(\d+)/); // ["2026-10-23", "2026", "10", "23", ...]

for (const m of "a1b22c333".matchAll(/\d+/g)) {
  console.log(m[0], m.index);            // 1 1, 22 3, 333 6
}

"hello world".replace(/o/g, "0");        // "hell0 w0rld"
```

Keep regexes small and tested; a clever one is a future bug.

## String literal types and template literal types

Because TypeScript has literal types, strings can *be* types:

```ts
type Size = "small" | "medium" | "large";
type EventName = `on${Capitalize<"click" | "hover">}`;   // "onClick" | "onHover"
```

Template literal types get a full lesson in the Advanced level; for now just know that `"small"` is a legitimate type.

## Common mistakes

- **Expecting methods to mutate.** `s.trim();` alone does nothing; use the result.
- **`replace` with a string only changes the first match.** Use `replaceAll` or a `/g` regex.
- **Trusting `length`** for user-visible characters with emoji or accents.
- **Building big strings with `+=` in a loop.** It works (engines optimise it), but collecting parts in an array and calling `join` is clearer.
- **Sorting text with `<` or default `sort()`** for human-facing lists; use `localeCompare`.
- **Using `==`.** Same advice as always: `===`.

## Exercises

1. Write `capitalize(word: string): string` that handles the empty string.
2. Write `isPalindrome(text: string): boolean` that ignores case, spaces and punctuation.
3. Count how many times each word appears in a sentence. (Just print them; Maps come in lesson 8.)
4. Print `"😀".length` and `[..."😀"].length` and explain the difference in your own words.
5. Turn `"snake_case_name"` into `"snakeCaseName"` with a regex and `replace`.
6. Pad a list of numbers so they right-align in a column.

## Recap

- Three quote styles; backticks give interpolation and multi-line strings.
- Strings are immutable: methods return new strings.
- `length` counts UTF-16 code units; iterate or use `Intl.Segmenter` for real characters.
- `===` to compare, `localeCompare` to order human text.
- Literal string types let you name an exact set of allowed strings.

Next: [Booleans & conditionals →](05-booleans-and-conditionals.md)
