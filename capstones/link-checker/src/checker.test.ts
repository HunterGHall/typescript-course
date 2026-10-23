import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { checkFile, findMarkdownFiles } from "./checker.js";

describe("checker", () => {
  let dir: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "linkcheck-"));
    await mkdir(join(dir, "sub"));
    await writeFile(join(dir, "setup.md"), "# Install\n");
    await writeFile(
      join(dir, "index.md"),
      [
        "# Home",
        "[ok](./setup.md)",
        "[missing](./missng.md)",
        "[bad anchor](./setup.md#instal)",
        "[good anchor](./setup.md#install)",
        "[self](#home)",
        "[web](https://example.com)",
      ].join("\n"),
    );
    await writeFile(join(dir, "sub", "deep.md"), "[up](../index.md)\n");
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("finds Markdown files recursively, sorted", async () => {
    const files = await findMarkdownFiles([dir]);
    assert.equal(files.length, 3);
    assert.deepEqual(files, [...files].sort());
  });

  it("reports ok, broken and skipped links", async () => {
    const results = await checkFile(join(dir, "index.md"));
    assert.deepEqual(
      results.map((r) => r.verdict.status),
      ["ok", "broken", "broken", "ok", "ok", "skipped"],
    );
  });

  it("resolves links relative to the containing file", async () => {
    const results = await checkFile(join(dir, "sub", "deep.md"));
    assert.equal(results[0]?.verdict.status, "ok");
  });
});
