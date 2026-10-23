import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { classify, extractLinks, headingSlugs, type Link } from "./links.js";

export type Verdict =
  | { status: "ok" }
  | { status: "skipped"; reason: string }
  | { status: "broken"; reason: string };

export interface Result {
  file: string;
  link: Link;
  verdict: Verdict;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Recursively finds .md files under each path (a file path is returned as is). */
export async function findMarkdownFiles(paths: string[]): Promise<string[]> {
  const found: string[] = [];
  async function walk(path: string): Promise<void> {
    const info = await stat(path);
    if (info.isFile()) {
      if (extname(path) === ".md") found.push(path);
      return;
    }
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await walk(join(path, entry.name));
    }
  }
  for (const p of paths) await walk(p);
  return found.sort();
}

/** Checks every link in one Markdown file. */
export async function checkFile(file: string): Promise<Result[]> {
  const text = await readFile(file, "utf8");
  const ownSlugs = headingSlugs(text);
  const results: Result[] = [];

  for (const link of extractLinks(text)) {
    const kind = classify(link.target);
    let verdict: Verdict;

    if (kind.kind === "url") {
      verdict = { status: "skipped", reason: "external URL" };
    } else if (kind.kind === "anchor") {
      verdict = ownSlugs.has(kind.fragment.toLowerCase())
        ? { status: "ok" }
        : { status: "broken", reason: `no heading #${kind.fragment}` };
    } else {
      const target = resolve(dirname(file), decodeURIComponent(kind.path));
      if (!(await exists(target))) {
        verdict = { status: "broken", reason: "file not found" };
      } else if (kind.fragment && extname(target) === ".md") {
        const slugs = headingSlugs(await readFile(target, "utf8"));
        verdict = slugs.has(kind.fragment.toLowerCase())
          ? { status: "ok" }
          : { status: "broken", reason: `no heading #${kind.fragment} in ${kind.path}` };
      } else {
        verdict = { status: "ok" };
      }
    }
    results.push({ file, link, verdict });
  }
  return results;
}
