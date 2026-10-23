# 3. Mapped & template literal types

## What & why

**Mapped types** transform every property of an object type; **template literal types** build and take apart string types. Together they let you derive whole families of types from one definition: getters from fields, event-handler names from event names, typed route parameters from a URL pattern. They are the "loops over keys and strings" of the type language.

## Mapped types

The syntax is `{ [K in Keys]: ValueType }`, where `Keys` is usually `keyof T`:

```ts
type Flags<T> = { [K in keyof T]: boolean };

interface Features {
  darkMode: string;
  beta: number;
}
type FeatureFlags = Flags<Features>;     // { darkMode: boolean; beta: boolean }
```

This is exactly how the standard library defines `Partial`, `Readonly`, `Pick` and `Record`:

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyRecord<K extends PropertyKey, V> = { [P in K]: V };
```

Because `[K in keyof T]` over a type parameter is a **homomorphic** mapped type, it preserves the original's `readonly` and `?` modifiers and also works element-wise over arrays and tuples:

```ts
type Stringify<T> = { [K in keyof T]: string };
type S = Stringify<[number, boolean]>;    // [string, string]
```

### Modifiers: `+` and `-`

Add or remove `readonly` and `?`:

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Concrete<T> = { [K in keyof T]-?: T[K] };       // removes ? (and, with strictness, `undefined` from optionals)

type Ex = Concrete<{ a?: number; readonly b: string }>;   // { a: number; b: string }
```

### Mapping over a union of literals

The key set doesn't have to come from `keyof`:

```ts
type Status = "idle" | "loading" | "done";
type StatusMessages = { [S in Status]: string };
// { idle: string; loading: string; done: string }

type Handlers = { [S in Status as `on${Capitalize<S>}`]: () => void };
// { onIdle: () => void; onLoading: () => void; onDone: () => void }
```

## Key remapping with `as`

Rename, filter or expand keys while mapping:

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person { name: string; age: number }
type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number }
```

`string & K` narrows the key to its string members (keys may also be `number | symbol`).

**Filtering** by remapping a key to `never` drops it:

```ts
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
type OS = OnlyStrings<{ a: string; b: number; c: string }>;   // { a: string; c: string }

type Without<T, U> = { [K in keyof T as Exclude<K, U>]: T[K] };   // a key-based Omit
```

## Mapped types + indexed access: distributing over unions

Map a union of tagged objects into a lookup:

```ts
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "key"; code: string };

type EventMap = { [E in Event as E["type"]]: E };
// { click: { type: "click"; x: number; y: number }; key: { type: "key"; code: string } }

type HandlerFor<T extends Event["type"]> = (event: EventMap[T]) => void;
```

And the "mapped type indexed by its own keys" idiom to produce a union:

```ts
type PropValues<T> = { [K in keyof T]: T[K] }[keyof T];    // union of property value types
```

## Template literal types

Interpolate types into string types:

```ts
type Greeting = `Hello, ${string}`;
const g: Greeting = "Hello, world";        // ok
// const bad: Greeting = "Bye";            // error

type Size = "sm" | "md" | "lg";
type Color = "red" | "blue";
type ClassName = `${Color}-${Size}`;
// "red-sm" | "red-md" | "red-lg" | "blue-sm" | "blue-md" | "blue-lg"
```

Unions in template positions produce the **cross product**. Keep an eye on size: 10 × 10 × 10 is a thousand strings.

### Intrinsic string types

`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize` transform string literals:

```ts
type Shout = Uppercase<"hello">;          // "HELLO"
type EventName<T extends string> = `on${Capitalize<T>}`;
type E = EventName<"click">;              // "onClick"
```

### Parsing strings with `infer`

Template literals work as patterns in conditional types:

```ts
type ExtractParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<`/${Rest}`>
    : Path extends `${string}:${infer Param}`
      ? Param
      : never;

type P = ExtractParams<"/users/:userId/posts/:postId">;     // "userId" | "postId"

type RouteParams<Path extends string> = { [K in ExtractParams<Path>]: string };

declare function route<P extends string>(path: P, handler: (params: RouteParams<P>) => void): void;

route("/users/:userId/posts/:postId", (params) => {
  params.userId;      // string
  params.postId;      // string
  // params.nope;     // error
});
```

This is how typed routers and query builders infer parameter names from a string.

More small recipes:

```ts
type CamelCase<S extends string> =
  S extends `${infer H}_${infer T}` ? `${H}${CamelCase<Capitalize<T>>}` : S;
type C = CamelCase<"user_first_name">;      // "userFirstName"

type Trim<S extends string> =
  S extends ` ${infer R}` | `${infer R} ` ? Trim<R> : S;
type T1 = Trim<"  hi  ">;                    // "hi"

type StartsWith<S extends string, P extends string> = S extends `${P}${string}` ? true : false;
```

### Typed event emitters (putting it together)

```ts
type EventMap2 = { click: { x: number }; change: { value: string } };

type Listeners<M> = {
  [K in keyof M as `on${Capitalize<string & K>}`]?: (payload: M[K]) => void;
};

const listeners: Listeners<EventMap2> = {
  onClick: ({ x }) => console.log(x),
  onChange: ({ value }) => console.log(value.length),
};
```

Adding an event to `EventMap2` adds a handler name everywhere. One source of truth.

## Typed `Object.keys`/`entries`

Mapped types let you write helpers that keep key types, when you're sure the object has no extra properties:

```ts
function typedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

function typedEntries<T extends object>(obj: T): Array<{ [K in keyof T]: [K, T[K]] }[keyof T]> {
  return Object.entries(obj) as never;
}
```

The `as` is a deliberate, contained lie: runtime objects *may* have extra keys, which is why the standard library returns `string[]`.

## Performance and readability

- Big unions × template literals can explode into tens of thousands of members and slow compilation. Measure with `tsc --extendedDiagnostics`.
- Recursive string parsing has depth limits; keep inputs small (route patterns, not whole documents).
- If a mapped type is hard to read in tooltips, wrap it in `Expand<T>` (lesson 1) so hovering shows a flat object.

## Common mistakes

- **Forgetting `string & K`** when using `Capitalize` on keys (keys can be `symbol`).
- **Losing modifiers** by mapping over a plain union instead of `keyof T`.
- **Expecting mapped types to be deep.** They're one level; use recursion for depth.
- **Exploding unions** with cross products.
- **Using `as` with `never` incorrectly:** `as never` *drops* the key (good for filtering), but `: never` as a value type keeps the key.
- **Overusing type-level cleverness** where a simple interface would do.

## Exercises

1. Write `Nullable<T>` making every property `T[K] | null`.
2. Write `Setters<T>` producing `{ setName: (v: string) => void; ... }`.
3. Write `PickByType<T, V>` keeping only properties whose values extend `V`.
4. Write `Prefix<T, P extends string>` that prefixes every key: `{ a: 1 }` → `{ prefix_a: 1 }`.
5. Extend `ExtractParams` to also support optional params written `:id?`.
6. Build `KebabCase<"fooBarBaz">` → `"foo-bar-baz"` (hard; you'll need a helper to detect uppercase).
7. Create a typed `on(emitter, "eventName", handler)` where the handler's payload type is looked up from an event map.

## Recap

- Mapped types: `{ [K in keyof T]: ... }` transform properties; `-?`/`-readonly` remove modifiers; `as` remaps or filters keys.
- Homomorphic mapped types preserve modifiers and map arrays/tuples element-wise.
- Template literal types construct strings from unions (cross product) and, with `infer`, parse them.
- Combine mapped and template types to derive APIs from a single definition.
- Watch compile-time cost and readability.

Next: [Variance & type-level safety →](04-variance-and-branding.md)
