# 5. Decorators & metaprogramming

## What & why

A **decorator** is a function that wraps or annotates a class or a class member at definition time, written with `@name` syntax. They let you factor cross-cutting concerns — logging, caching, validation, registration, dependency injection — out of the code they decorate. Frameworks such as Angular, NestJS and TypeORM are built on them.

TypeScript 5.0 implemented the **standard (TC39 Stage 3) decorators**. These differ from the older `experimentalDecorators` flag still used by some frameworks. This lesson teaches the standard version, which needs no compiler flag, and ends with the language's other metaprogramming tools: `Proxy`, `Reflect` and symbols.

!!! note
    Standard decorators are compiled by `tsc` (down-levelled for your `target`), but Node's built-in type stripping cannot run them. If you use decorators, compile with `tsc` or a bundler. If a framework tells you to enable `experimentalDecorators`, you are in the legacy system, whose API is different.

## The shape of a decorator

Every standard decorator receives the thing being decorated and a **context** object, and may return a replacement:

```ts
type Decorator<Value, Context> = (value: Value, context: Context) => Value | void;
```

The context's `kind` says what is being decorated: `"class"`, `"method"`, `"getter"`, `"setter"`, `"field"` or `"accessor"`; `context.name` is the member's name; `context.addInitializer(fn)` registers code to run per instance (or at class definition for static members).

## A method decorator

```ts
function logged<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
  const name = String(context.name);
  return function (this: This, ...args: Args): Return {
    console.log(`-> ${name}(${args.map(String).join(", ")})`);
    const result = target.call(this, ...args);
    console.log(`<- ${name} =`, result);
    return result;
  };
}

class Calculator {
  @logged
  add(a: number, b: number): number {
    return a + b;
  }
}

new Calculator().add(2, 3);
// -> add(2, 3)
// <- add = 5
```

The generics preserve the decorated method's exact signature, so callers still get full type checking.

## A decorator with arguments (a factory)

Write a function that *returns* the decorator:

```ts
function retry(times: number) {
  return function <This, Args extends unknown[], Return>(
    target: (this: This, ...args: Args) => Promise<Return>,
    _context: ClassMethodDecoratorContext,
  ) {
    return async function (this: This, ...args: Args): Promise<Return> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= times; attempt++) {
        try {
          return await target.call(this, ...args);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    };
  };
}

class Api {
  @retry(3)
  async load(id: number): Promise<string> {
    // may fail
    return `item ${id}`;
  }
}
```

## Class decorators

A class decorator receives the class and can return a replacement (usually a subclass) or just register it:

```ts
const registry = new Map<string, new (...args: never[]) => object>();

function register(name: string) {
  return function <T extends new (...args: never[]) => object>(target: T, context: ClassDecoratorContext) {
    registry.set(name, target);
    context.addInitializer(() => console.log(`registered ${name}`));
    return target;
  };
}

@register("greeter")
class Greeter {
  hello() {
    return "hi";
  }
}
```

## Field and accessor decorators

A field decorator can't see the field's value yet; it returns an **initializer function** that transforms the initial value:

```ts
function defaultTo<T>(value: T) {
  return function (_target: undefined, _context: ClassFieldDecoratorContext) {
    return (initial: T | undefined): T => initial ?? value;
  };
}

class Settings {
  @defaultTo(8080) port?: number;
}
```

The `accessor` keyword (also standard) declares an auto-generated getter/setter pair backed by private storage, which accessor decorators can wrap — handy for change tracking and reactivity:

```ts
function observed<This, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value> {
  return {
    get(this: This) {
      return target.get.call(this);
    },
    set(this: This, value: Value) {
      console.log(`${String(context.name)} changed to`, value);
      target.set.call(this, value);
    },
  };
}

class Form {
  @observed accessor name = "";
}

const f = new Form();
f.name = "Ada";            // name changed to Ada
```

## Binding methods with `addInitializer`

```ts
function bound<This, Args extends unknown[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This>,
) {
  context.addInitializer(function (this: This) {
    (this as Record<string | symbol, unknown>)[context.name] = target.bind(this);
  });
}

class Button {
  label = "OK";
  @bound onClick() {
    return this.label;
  }
}

const { onClick } = new Button();
onClick();                  // "OK" — `this` survived being detached
```

## Composing decorators

Multiple decorators apply bottom-up (closest to the member first) and *evaluate* their factory expressions top-down:

```ts
class Service {
  @logged
  @retry(2)
  async run() {}
}
// retry wraps run(); logged wraps the result
```

## When decorators are the wrong tool

Decorators hide behaviour behind syntax. Before using one, ask whether a higher-order function does the job more visibly:

```ts
const loadWithRetry = withRetry(3, load);
```

Reach for decorators when the framework expects them, or when annotating many members declaratively (routes, validation rules, serialisation fields) is clearly nicer than the alternative. Be wary of "magic" that reorders execution in non-obvious ways.

## Metadata

Standard decorators can record information via `context.metadata` (TypeScript 5.2+). Add `"ESNext.Decorators"` to `lib` for the types, and note that Node does not define `Symbol.metadata` yet, so install a tiny polyfill first (`Symbol.metadata ??= Symbol("Symbol.metadata");`) in the entry module:

```ts
function route(path: string) {
  return (_target: unknown, context: ClassMethodDecoratorContext) => {
    const routes = ((context.metadata["routes"] ??= []) as Array<{ path: string; method: string | symbol }>);
    routes.push({ path, method: context.name });
  };
}

class Controller {
  @route("/users") list() {}
  @route("/users/:id") get() {}
}

const routes = (Controller as any)[Symbol.metadata]?.["routes"];
```

This is how declarative routing and validation libraries discover what you annotated, without reflection-metadata hacks.

## Other metaprogramming: `Proxy` and `Reflect`

A `Proxy` intercepts operations on an object:

```ts
function observe<T extends object>(target: T, onChange: (key: string | symbol, value: unknown) => void): T {
  return new Proxy(target, {
    set(obj, key, value, receiver) {
      onChange(key, value);
      return Reflect.set(obj, key, value, receiver);
    },
    get(obj, key, receiver) {
      return Reflect.get(obj, key, receiver);
    },
  });
}

const state = observe({ count: 0 }, (k, v) => console.log(k, "=", v));
state.count++;             // count = 1
```

`Reflect` provides the default behaviour for each trap, so you add logic and then forward. Proxies power reactive frameworks, mocking libraries and ORMs. Costs: they're slower than plain objects, they can't be perfectly transparent (identity, private fields `#x` aren't forwarded), and they defeat static types if you return surprising shapes.

### Well-known symbols

Symbols let you hook into language protocols:

```ts
class Range {
  constructor(private from: number, private to: number) {}
  *[Symbol.iterator](): Generator<number> {
    for (let i = this.from; i <= this.to; i++) yield i;
  }
  [Symbol.toPrimitive](hint: string) {
    return hint === "string" ? `${this.from}..${this.to}` : this.to - this.from;
  }
}

[...new Range(1, 3)];       // [1, 2, 3]
`${new Range(1, 3)}`;       // "1..3"
```

Others: `Symbol.asyncIterator`, `Symbol.hasInstance`, `Symbol.dispose` (lesson 8 of Intermediate), `Symbol.toStringTag`.

## Common mistakes

- **Mixing legacy and standard decorators.** Check whether your framework needs `experimentalDecorators`; the two APIs aren't compatible.
- **Running `.ts` files with decorators directly in Node** — type stripping doesn't transform them.
- **Typing decorators with `any`,** which defeats the point; use `This`, `Args`, `Return` generics.
- **Forgetting to return** the wrapper function from a method decorator.
- **Relying on decorator order** without testing it.
- **Over-using `Proxy`** where a plain wrapper would be clearer and faster.
- **Using decorators for logic that belongs in plain functions.**

## Exercises

1. Write a `@timed` method decorator that logs how long each call takes (support both sync and async methods).
2. Write `@memoize` for zero-argument getters and test that the body runs once.
3. Write `@validate(min, max)` as an `accessor` decorator that throws on out-of-range assignment.
4. Build `@route` and `@controller` decorators that collect metadata, then write a function that lists all routes of a class.
5. Wrap an object in a `Proxy` that throws on reads of undefined properties (typos become loud).
6. Implement `Symbol.asyncIterator` on a class that yields numbers with a delay.

## Recap

- Standard decorators take `(value, context)` and may return a replacement; `context.kind` says what is decorated.
- Method, class, field and accessor decorators; factories for arguments; `addInitializer` for per-instance setup.
- Decorators compile with `tsc`; Node's type stripping can't run them.
- Prefer plain higher-order functions when a decorator isn't clearly better.
- `Proxy`/`Reflect` and well-known symbols are the runtime metaprogramming tools.

Next: [The event loop & concurrency →](06-event-loop.md)
