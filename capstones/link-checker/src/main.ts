import { checkFile, findMarkdownFiles, type Result } from "./checker.js";

const args = process.argv.slice(2);
const quiet = args.includes("-q") || args.includes("--quiet");
const paths = args.filter((a) => !a.startsWith("-"));

let files: string[];
try {
  files = await findMarkdownFiles(paths.length > 0 ? paths : ["."]);
} catch (error) {
  console.error(`linkcheck: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const tag = { ok: "OK   ", skipped: "SKIP ", broken: "FAIL " } as const;
const totals = { ok: 0, skipped: 0, broken: 0 };
let count = 0;

for (const file of files) {
  const results: Result[] = await checkFile(file);
  count += results.length;
  for (const r of results) totals[r.verdict.status]++;

  const shown = quiet ? results.filter((r) => r.verdict.status === "broken") : results;
  if (shown.length === 0) continue;
  console.log(`\n${file}`);
  for (const r of shown) {
    const note = r.verdict.status === "ok" ? "" : `  (${r.verdict.reason})`;
    console.log(`  ${tag[r.verdict.status]} ${r.link.line}:${r.link.target}${note}`);
  }
}

console.log(
  `\nChecked ${count} links in ${files.length} files: ` +
    `${totals.ok} OK, ${totals.broken} broken, ${totals.skipped} skipped`,
);
process.exit(totals.broken > 0 ? 1 : 0);
