/** A link found in a Markdown document. */
export interface Link {
  line: number; // 1-based
  target: string; // exactly as written, minus any title
}

export type LinkKind =
  | { kind: "url" }
  | { kind: "anchor"; fragment: string }
  | { kind: "file"; path: string; fragment: string | undefined };

// MARK: classification

/** "https:", "mailto:" — but not a Windows drive letter such as "C:\". */
function hasScheme(text: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]+:/.test(text);
}

export function classify(target: string): LinkKind {
  if (target.startsWith("#")) return { kind: "anchor", fragment: target.slice(1) };
  if (hasScheme(target)) return { kind: "url" };

  let path = target;
  let fragment: string | undefined;
  const hash = path.indexOf("#");
  if (hash !== -1) {
    fragment = path.slice(hash + 1);
    path = path.slice(0, hash);
  }
  const question = path.indexOf("?");
  if (question !== -1) path = path.slice(0, question);
  return { kind: "file", path, fragment };
}

// MARK: headings and slugs

/** GitHub-style anchor: "Hello, World!" -> "hello-world". */
export function slugify(heading: string): string {
  let slug = "";
  for (const ch of heading.toLowerCase()) {
    if (/[\p{L}\p{N}_-]/u.test(ch)) slug += ch;
    else if (ch === " ") slug += "-";
    // everything else (punctuation) is dropped
  }
  return slug;
}

/** Yields the lines of `text` outside fenced code blocks, with 1-based numbers. */
function* proseLines(text: string): Generator<[number, string]> {
  let fence: string | undefined;
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (m) {
      const marker = m[1]![0]!;
      if (fence === undefined) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence === undefined) yield [i + 1, line];
  }
}

/** The set of anchors a document offers; duplicates get -1, -2 ... like GitHub. */
export function headingSlugs(text: string): Set<string> {
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  for (const [, line] of proseLines(text)) {
    const m = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slugify(m[1]!.replace(/[`*_]/g, ""));
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

// MARK: extraction

function stripTitle(raw: string): string {
  const target = raw.trim();
  if (target.startsWith("<") && target.includes(">")) return target.slice(1, target.indexOf(">"));
  const space = target.search(/\s/);
  return space === -1 ? target : target.slice(0, space);
}

/** Finds inline links, images, reference definitions and autolinks, skipping code. */
export function extractLinks(text: string): Link[] {
  const links: Link[] = [];
  for (const [line, raw] of proseLines(text)) {
    const code = raw.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));

    const reference = /^ {0,3}\[[^\]]+\]:\s*(\S+)/.exec(code);
    if (reference) {
      links.push({ line, target: reference[1]! });
      continue;
    }
    for (const m of code.matchAll(/\]\(([^)]*)\)/g)) {
      const target = stripTitle(m[1]!);
      if (target !== "") links.push({ line, target });
    }
    for (const m of code.matchAll(/<([A-Za-z][A-Za-z0-9+.-]+:[^>\s]+)>/g)) {
      links.push({ line, target: m[1]! });
    }
  }
  return links;
}
