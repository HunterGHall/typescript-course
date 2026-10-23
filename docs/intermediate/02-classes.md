# 2. Classes

## What & why

A **class** bundles data (fields) with the behaviour that operates on it (methods) and creates instances with `new`. TypeScript adds access modifiers, `abstract`, `implements` and parameter properties to JavaScript's classes. Use classes when you have state that must be protected and updated through a controlled set of operations; use plain objects and functions for plain data.

## A first class

```ts
class Account {
  readonly id: string;
  private balance: number;

  constructor(id: string, opening = 0) {
    this.id = id;
    this.balance = opening;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new RangeError("Deposit must be positive");
    this.balance += amount;
  }

  getBalance(): number {
    return this.balance;
  }
}

const acct = new Account("A-1", 100);
acct.deposit(50);
console.log(acct.getBalance());   // 150
// acct.balance;                  // ERROR: Property 'balance' is private
```

Under `strict`, every field must be assigned in the constructor (or have an initializer), otherwise: *Property has no initializer and is not definitely assigned*.

## Parameter properties

A shortcut that declares and assigns fields from constructor parameters:

```ts
class Point {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}

  distanceTo(other: Point): number {
    return Math.hypot(this.x - other.x, this.y - other.y);
  }
}

new Point(0, 0).distanceTo(new Point(3, 4));   // 5
```

## Access modifiers: `public`, `private`, `protected`, `#private`

- `public` (default): anywhere.
- `protected`: the class and its subclasses.
- `private`: the class only — **compile-time only**. At runtime the field is an ordinary property.
- `#field`: JavaScript's own **runtime-enforced** private field.

```ts
class Counter {
  #count = 0;                    // truly private at runtime
  increment(): number {
    return ++this.#count;
  }
}
```

Use `#` when privacy genuinely matters (library code); `private` is fine for everyday application code and is slightly easier to test around.

## Getters, setters and static members

```ts
class Temperature {
  #celsius = 0;

  get celsius(): number {
    return this.#celsius;
  }
  set celsius(value: number) {
    if (value < -273.15) throw new RangeError("Below absolute zero");
    this.#celsius = value;
  }
  get fahrenheit(): number {
    return this.#celsius * 1.8 + 32;
  }

  static fromFahrenheit(f: number): Temperature {
    const t = new Temperature();
    t.celsius = (f - 32) / 1.8;
    return t;
  }
}

const t = Temperature.fromFahrenheit(212);
console.log(t.celsius);      // 100
```

A getter with no setter is read-only.

## Inheritance

```ts
class Shape {
  constructor(public readonly name: string) {}
  area(): number {
    return 0;
  }
  describe(): string {
    return `${this.name} with area ${this.area().toFixed(2)}`;
  }
}

class Circle extends Shape {
  constructor(private radius: number) {
    super("circle");             // must call super before using `this`
  }
  override area(): number {      // `override` makes the compiler check there's something to override
    return Math.PI * this.radius ** 2;
  }
}

console.log(new Circle(2).describe());   // circle with area 12.57
```

Turn on `noImplicitOverride` so forgetting `override` is an error — it catches typos in method names.

## Abstract classes

Provide shared behaviour while forcing subclasses to fill in the rest:

```ts
abstract class Shape2 {
  abstract area(): number;       // no body
  describe(): string {
    return `area ${this.area()}`;
  }
}

// new Shape2();                 // ERROR: Cannot create an instance of an abstract class

class Square extends Shape2 {
  constructor(private side: number) {
    super();
  }
  area(): number {
    return this.side ** 2;
  }
}
```

## `implements`: classes against interfaces

```ts
interface Printable {
  print(): string;
}

class Invoice implements Printable {
  constructor(private total: number) {}
  print(): string {
    return `Invoice: ${this.total}`;
  }
}
```

`implements` only **checks** that the class has the members; it copies nothing. Depend on interfaces in function parameters so any compatible class (or plain object) works:

```ts
function printAll(items: Printable[]): void {
  for (const item of items) console.log(item.print());
}
```

## Composition over inheritance

Deep class hierarchies get brittle. Prefer small classes that **hold** collaborators:

```ts
class ReportService {
  constructor(private readonly logger: { log(msg: string): void }) {}
  run(): void {
    this.logger.log("running report");
  }
}

new ReportService(console).run();    // anything with a log method works
```

This is also easy to test: pass a fake logger.

## `this` and callbacks

Methods lose `this` when detached:

```ts
class Button {
  label = "OK";
  onClick() {
    console.log(this.label);
  }
}

const b = new Button();
const handler = b.onClick;
handler();                   // TypeError: Cannot read properties of undefined
```

Fixes: an arrow function property, or `bind`:

```ts
class Button2 {
  label = "OK";
  onClick = () => console.log(this.label);   // `this` is fixed to the instance
}
```

## Classes are structural too

```ts
class A { x = 1 }
class B { x = 2 }
const a: A = new B();       // allowed — same shape
```

Classes with `private` or `protected` members are the exception: they become effectively nominal, because only the declaring class can supply those members.

## Class types: instance vs constructor

```ts
const c: Circle = new Circle(1);       // `Circle` as a type = the instance type
const ctor: typeof Circle = Circle;    // `typeof Circle` = the constructor function
```

## Common mistakes

- **Assuming `private` is enforced at runtime.** It isn't; `#private` is.
- **Forgetting `super(...)`** in a subclass constructor, or using `this` before it.
- **Detaching a method** and losing `this`.
- **Deep inheritance** for code reuse. Compose instead.
- **Classes for plain data.** An interface plus functions is often simpler, easier to serialize and easier to test.
- **Mutable public fields** that let any code break invariants. Keep state private and expose methods.

## Exercises

1. Build `Stack<T>`-like behaviour with a class `NumberStack` (private array; `push`, `pop`, `peek`, `size` getter). `pop` on empty returns `undefined`.
2. Write `abstract class Employee` with an abstract `pay(): number`, and `Salaried` and `Hourly` subclasses. Sum a mixed array.
3. Implement an interface `Clock { now(): Date }` with a real clock and a fixed test clock; inject it into a class.
4. Reproduce the lost-`this` bug and fix it two ways.
5. Add validation to a setter and show a `RangeError` when it's violated.
6. Convert one of your classes to a plain object plus functions. Which version do you prefer, and why?

## Recap

- Classes combine state and behaviour; `new` creates instances.
- Parameter properties cut boilerplate; `readonly` and getters protect invariants.
- `private` is compile-time, `#private` is runtime; `protected` allows subclasses.
- `extends` + `override` for specialization, `abstract` for partial implementations, `implements` to check a contract.
- Prefer composition; beware detached methods and `this`.

Next: [Unions & discriminated unions →](03-unions.md)
