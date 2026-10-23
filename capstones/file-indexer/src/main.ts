import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { buildIndex, findFiles } from "./builder.js";
import { topTerms } from "./model.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    jobs: { type: "string", short: "j", default: String(availableParallelism()) },
    top: { type: "string", short: "n", default: "10" },
  },
});

const jobs = Number(values.jobs);
const top = Number(values.top);
if (!Number.isInteger(jobs) || jobs < 1 || !Number.isInteger(top) || top < 1) {
  console.error("Usage: indexer [-j <threads>] [-n <top>] [dir]");
  process.exit(2);
}

const root = positionals[0] ?? ".";
const started = performance.now();

let paths: string[];
try {
  paths = await findFiles(root);
} catch (error) {
  console.error(`indexer: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const { index, errors } = await buildIndex(paths, { concurrency: jobs });

const totals = index.files.reduce(
  (t, f) => ({ bytes: t.bytes + f.bytes, lines: t.lines + f.lines, words: t.words + f.words }),
  { bytes: 0, lines: 0, words: 0 },
);

console.log(`Indexed ${index.files.length} files: ${totals.lines} lines, ${totals.words} words, ${totals.bytes} bytes`);
console.log(`\nTop ${top} terms:`);
for (const [term, n] of topTerms(index, top)) {
  console.log(`  ${String(n).padStart(6)}  ${term}`);
}
for (const e of errors) console.error(`error: ${e.path}: ${e.error}`);

// Timing goes to stderr so stdout stays identical across runs and thread counts.
console.error(`(${jobs} threads, ${Math.round(performance.now() - started)} ms)`);
process.exit(errors.length > 0 ? 1 : 0);
