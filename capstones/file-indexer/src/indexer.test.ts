import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { buildIndex, findFiles } from "./builder.js";
import { indexText, mergeIndexes, tokenize, topTerms } from "./model.js";

describe("model", () => {
  it("tokenizes into lowercase words", () => {
    assert.deepEqual(tokenize("Hello, World! Don't stop."), ["hello", "world", "don't", "stop"]);
  });

  it("counts lines, words, bytes and terms", () => {
    const { stats, terms } = indexText("a.txt", "the cat\nthe hat\n");
    assert.deepEqual(stats, { path: "a.txt", bytes: 16, lines: 2, words: 4 });
    assert.deepEqual({ ...terms }, { the: 2, cat: 1, hat: 1 });
  });

  it("merges in any order to the same result", () => {
    const a = indexText("a.txt", "x y x");
    const b = indexText("b.txt", "y z");
    const one = mergeIndexes([a, b]);
    const two = mergeIndexes([b, a]);
    assert.deepEqual(one.files, two.files);
    assert.deepEqual(topTerms(one, 3), topTerms(two, 3));
    assert.deepEqual(topTerms(one, 3), [["x", 2], ["y", 2], ["z", 1]]);
  });
});

describe("buildIndex", () => {
  let dir: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "indexer-"));
    await mkdir(join(dir, "nested"));
    for (let i = 0; i < 20; i++) {
      const folder = i % 2 === 0 ? dir : join(dir, "nested");
      await writeFile(join(folder, `f${i}.txt`), `alpha beta ${"gamma ".repeat(i)}\nline two\n`);
    }
    await writeFile(join(dir, "ignored.bin"), "alpha");
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("only finds text files", async () => {
    assert.equal((await findFiles(dir)).length, 20);
  });

  it("gives identical output at any concurrency", async () => {
    const paths = await findFiles(dir);
    const one = await buildIndex(paths, { concurrency: 1 });
    const many = await buildIndex(paths, { concurrency: 6 });

    assert.deepEqual(one.index.files, many.index.files);
    assert.deepEqual(topTerms(one.index, 5), topTerms(many.index, 5));
    assert.equal(one.index.terms.get("alpha"), 20);
    assert.equal(one.index.terms.get("gamma"), (19 * 20) / 2);
    assert.deepEqual(one.errors, []);
  });

  it("reports unreadable files instead of failing the whole run", async () => {
    const result = await buildIndex([join(dir, "missing.txt"), join(dir, "f0.txt")]);
    assert.equal(result.errors.length, 1);
    assert.equal(result.index.files.length, 1);
  });

  it("handles an empty file list", async () => {
    const result = await buildIndex([]);
    assert.equal(result.index.files.length, 0);
  });
});
