import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, extractLinks, headingSlugs, slugify } from "./links.js";

describe("classify", () => {
  it("recognises URLs, anchors and files", () => {
    assert.deepEqual(classify("https://example.com"), { kind: "url" });
    assert.deepEqual(classify("mailto:a@b.c"), { kind: "url" });
    assert.deepEqual(classify("#intro"), { kind: "anchor", fragment: "intro" });
    assert.deepEqual(classify("./a.md#x"), { kind: "file", path: "./a.md", fragment: "x" });
    assert.deepEqual(classify("a.md?raw=1"), { kind: "file", path: "a.md", fragment: undefined });
  });

  it("does not mistake a Windows drive letter for a scheme", () => {
    assert.equal(classify("C:\\docs\\a.md").kind, "file");
  });
});

describe("slugify", () => {
  it("follows GitHub's rules", () => {
    assert.equal(slugify("Hello, World!"), "hello-world");
    assert.equal(slugify("Getting Started"), "getting-started");
    assert.equal(slugify("snake_case & kebab-case"), "snake_case--kebab-case");
  });
});

describe("headingSlugs", () => {
  it("numbers duplicates and ignores code fences", () => {
    const md = ["# Intro", "## Setup", "## Setup", "```", "# not a heading", "```"].join("\n");
    assert.deepEqual([...headingSlugs(md)], ["intro", "setup", "setup-1"]);
  });
});

describe("extractLinks", () => {
  it("finds inline links, images, references and autolinks with line numbers", () => {
    const md = [
      'See [a](./a.md) and ![img](pic.png "title").',
      "[ref]: ./b.md",
      "<https://example.com>",
    ].join("\n");
    assert.deepEqual(extractLinks(md), [
      { line: 1, target: "./a.md" },
      { line: 1, target: "pic.png" },
      { line: 2, target: "./b.md" },
      { line: 3, target: "https://example.com" },
    ]);
  });

  it("skips fenced and inline code", () => {
    const md = ["`[x](nope.md)`", "```", "[y](nope2.md)", "```", "[z](yes.md)"].join("\n");
    assert.deepEqual(extractLinks(md), [{ line: 5, target: "yes.md" }]);
  });
});
