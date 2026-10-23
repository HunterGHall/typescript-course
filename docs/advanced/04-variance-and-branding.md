# 4. Variance & type-level safety

## What & why

Two questions drive this lesson. First: when is `Box<Dog>` assignable to `Box<Animal>`? That's **variance**, and it explains many puzzling errors and the soundness holes mentioned earlier. Second: how do you stop two different things that happen to have the same *shape* — a user ID and an order ID, meters and feet — from being mixed up? That's **branding**, and it is one of the most useful patterns in real codebases.

## Variance

Let `Dog` be a subtype of `Animal` (every `Dog` is an `Animal`).

```ts
interface Animal { name: string }
interface Dog extends Animal { bark(): void }
```

### Covariance: same direction

A type is **covariant** in `T` if `Dog` → `Animal` implies `F<Dog>` → `F<Animal>`. Read-only producers are covariant:

```ts
const dogs: readonly Dog[] = [];
const animals: readonly Animal[] = dogs;     // fine — you can only read Animals out of it

type Producer<T> = () => T;
declare const makeDog: Producer<Dog>;
const makeAnimal: Producer<Animal> = makeDog;   // fine
```

Return types and read-only properties are covariant.

### Contravariance: opposite direction

A type is **contravariant** in `T` if `Dog` → `Animal` implies `F<Animal>` → `F<Dog>` — it flips. Consumers are contravariant:

```ts
type Consumer<T> = (value: T) => void;

declare const feedAnimal: Consumer<Animal>;
const feedDog: Consumer<Dog> = feedAnimal;    // fine: something that handles any Animal can handle a Dog

declare const feedAnyDog: Consumer<Dog>;
// const feedAny: Consumer<Animal> = feedAnyDog;   // error (with strictFunctionTypes): it might receive a Cat
```

Parameter types of functions are contravariant (under `strict`).

### Invariance

If `T` is both produced and consumed, it's **invariant**: neither direction is safe.

```ts
interface Box<T> { get(): T; set(value: T): void }
// Box<Dog> is not safely assignable to Box<Animal>: someone could set(cat)
```

### Where TypeScript is unsound on purpose

Mutable arrays are treated covariantly for convenience, and **method** parameters are checked bivariantly (both directions allowed):

```ts
const dogs: Dog[] = [];
const animals: Animal[] = dogs;       // allowed, though unsound...
animals.push({ name: "Whiskers" });   // ...a non-Dog now lives in `dogs`

interface Handler1 { handle(a: Animal): void }       // method syntax: bivariant parameters
interface Handler2 { handle: (a: Animal) => void }   // property syntax: strict (contravariant)
```

If you want strictness, use property syntax with function types for callbacks.

### Annotating variance: `in` and `out`

For generic interfaces/classes you can declare how `T` is used, and the compiler verifies it:

```ts
interface ReadonlyBox<out T> { get(): T }                 // covariant
interface Sink<in T> { put(value: T): void }              // contravariant
interface Cell<in out T> { get(): T; set(v: T): void }    // invariant
```

This documents intent, catches accidental violations, and speeds up type checking of deeply generic code.

## Branded types

Structural typing means identical shapes are interchangeable:

```ts
type UserId = string;
type OrderId = string;

function cancelOrder(id: OrderId) {}
const userId: UserId = "u_123";
cancelOrder(userId);          // compiles! wrong ID, same shape
```

A **brand** adds a phantom marker that exists only in the type system:

```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

function userId(raw: string): UserId {
  if (!/^u_\d+$/.test(raw)) throw new Error(`Bad user id: ${raw}`);
  return raw as UserId;            // the single cast, guarded by a check
}

const u = userId("u_123");
const o = "o_9" as OrderId;

function cancelOrder(id: OrderId) {}
// cancelOrder(u);                 // error: UserId is not assignable to OrderId
// cancelOrder("o_9");             // error: a plain string is not an OrderId
cancelOrder(o);
```

At runtime a `UserId` is just a string — no wrapper, no cost. The brand property never exists. Because `UserId` is still a `string & {...}`, it can be used wherever a `string` is expected (`u.length`, template literals).

### The "parse, don't validate" pattern

Make the *constructor* the only place a brand is created, and have it validate:

```ts
type Email = Brand<string, "Email">;

function parseEmail(input: string): Email | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) ? (input as Email) : undefined;
}

function sendWelcome(to: Email) {}      // can only be called with something that was validated

const e = parseEmail(form.email);
if (e) sendWelcome(e);
```

Once a value carries the brand, every function downstream can rely on the property without re-checking. Typical brands: `PositiveInt`, `NonEmptyString`, `Url`, `Sanitized`, `Meters`/`Feet`, `Cents`.

### Units of measure

```ts
type Meters = Brand<number, "Meters">;
type Feet = Brand<number, "Feet">;

const meters = (n: number) => n as Meters;
const feet = (n: number) => n as Feet;
const toMeters = (f: Feet): Meters => meters(f * 0.3048);

function climb(height: Meters) {}
// climb(feet(100));               // error — saved a Mars orbiter
climb(toMeters(feet(100)));
```

### Alternative: a class with a private field

```ts
class UserId2 {
  private readonly __brand = "UserId2";
  constructor(readonly value: string) {}
}
```

A `private` member makes the class nominal (only instances of this class fit), but it costs an object allocation. The intersection brand is lighter and the common choice.

## `unique symbol` and exhaustive identity

```ts
declare const sentinel: unique symbol;
type Sentinel = typeof sentinel;           // a type with exactly one possible value
```

Each `unique symbol` is its own type, which is why the brand key above can't collide with a real property.

## Making illegal states unrepresentable with phantom states

Phantom type parameters (never used in values) can encode a *state machine* in the type:

```ts
type Draft = { readonly _state: "draft" };
type Published = { readonly _state: "published" };

class Post<S> {
  private constructor(readonly title: string, private readonly state?: S) {}
  static draft(title: string): Post<Draft> {
    return new Post<Draft>(title);
  }
  publish(this: Post<Draft>): Post<Published> {
    return new Post<Published>(this.title);
  }
  url(this: Post<Published>): string {
    return `/posts/${this.title}`;
  }
}

const d = Post.draft("hi");
// d.url();                      // error: 'this' of type Post<Draft> isn't assignable to Post<Published>
const url = d.publish().url();   // fine
```

The `this` parameter makes methods available only in the right state. This is the **typestate** pattern, ideal for builders and protocols ("must call `open()` before `read()`").

## Type-safe builders

```ts
class RequestBuilder<HasUrl extends boolean = false> {
  private constructor(private readonly parts: { url?: string; method?: string }) {}
  static create(): RequestBuilder<false> {
    return new RequestBuilder({});
  }
  url(u: string): RequestBuilder<true> {
    return new RequestBuilder({ ...this.parts, url: u });
  }
  method(m: string): RequestBuilder<HasUrl> {
    return new RequestBuilder({ ...this.parts, method: m });
  }
  build(this: RequestBuilder<true>): Request {
    return new Request(this.parts.url!, { method: this.parts.method ?? "GET" });
  }
}

RequestBuilder.create().method("POST").url("https://x.test").build();   // ok
// RequestBuilder.create().build();                                      // error: url() not called
```

## Exhaustive tables with `satisfies`

```ts
const handlers = {
  click: (e: MouseEvent) => {},
  key: (e: KeyboardEvent) => {},
} satisfies Record<"click" | "key", (e: never) => void>;
```

Adding an event name to the union makes the object incomplete — and a compile error.

## Common mistakes

- **Assuming `Array<Dog>` → `Array<Animal>` is safe.** It compiles but isn't.
- **Using method syntax for callbacks** and losing contravariant checking.
- **Casting to a brand everywhere** (`x as UserId`). Cast only in the one validating constructor.
- **Leaking the brand symbol** into runtime code — it should be `declare`d only.
- **Over-branding** trivial strings and burying the code in conversions. Brand things where mix-ups are costly (IDs, units, trust levels).
- **Forgetting that brands vanish at runtime:** JSON from outside must be parsed into the brand again.

## Exercises

1. For each of `() => T`, `(x: T) => void`, `T[]`, `readonly T[]` and `{ value: T }`, decide whether `T` is covariant, contravariant or invariant, then check with `in`/`out` annotations.
2. Brand `UserId`, `OrderId`, `ProductId`; write functions accepting each; verify cross-use fails.
3. Create `PositiveInt` with a validating constructor and use it in a `repeat(text, n)` function.
4. Implement typestate for a `Connection`: only `Connected` can `send()`, only `Disconnected` can `connect()`.
5. Build a `QueryBuilder` that refuses to `build()` without a table name and a select list.
6. Write a `Sanitized<string>` brand and an `render(html: Sanitized<string>)` that only accepts sanitised input.

## Recap

- Producers are covariant, consumers contravariant, read-write positions invariant; arrays and method syntax are intentionally unsound.
- `in`/`out` annotations document and verify variance.
- Brand types add nominal safety on top of structural typing at zero runtime cost.
- Create brands in one validating function — "parse, don't validate".
- Phantom parameters and `this` types encode state machines so illegal call orders don't compile.

Next: [Decorators & metaprogramming →](05-decorators.md)
