/** Statistics for one file. */
export interface FileStats {
  path: string;
  bytes: number;
  lines: number;
  words: number;
}

/** What a worker sends back for one file: its stats plus per-term counts. */
export interface FileIndex {
  stats: FileStats;
  terms: Record<string, number>;
}

/** The merged result for a whole directory tree. */
export interface Index {
  files: FileStats[]; // sorted by path
  terms: Map<string, number>; // term -> total occurrences
}

/** Lowercased words made of letters, digits and apostrophes. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

/** Pure: the whole per-file computation, so it can be tested without threads or disk. */
export function indexText(path: string, text: string): FileIndex {
  const words = tokenize(text);
  const terms: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const w of words) terms[w] = (terms[w] ?? 0) + 1;
  const lines = text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  return {
    stats: { path, bytes: Buffer.byteLength(text), lines, words: words.length },
    terms,
  };
}

/** Order-independent merge: sorting by path makes the result identical for any scheduling. */
export function mergeIndexes(parts: FileIndex[]): Index {
  const files = parts.map((p) => p.stats).sort((a, b) => a.path.localeCompare(b.path));
  const terms = new Map<string, number>();
  for (const part of parts) {
    for (const [term, n] of Object.entries(part.terms)) {
      terms.set(term, (terms.get(term) ?? 0) + n);
    }
  }
  return { files, terms };
}

/** Most frequent terms; ties broken alphabetically so output is deterministic. */
export function topTerms(index: Index, n: number): [string, number][] {
  return [...index.terms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}
