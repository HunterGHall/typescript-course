#!/usr/bin/env bash
# Builds, tests and smoke-tests every capstone. Used by CI; handy locally too.
set -euo pipefail
cd "$(dirname "$0")"

node --version
npm --version

echo "== task-tracker =="
(
  cd task-tracker
  npm ci
  npm run build
  export TASKS_FILE="$PWD/smoke-$$.txt"
  trap 'rm -f "$TASKS_FILE"' EXIT
  node dist/main.js add "Buy milk"
  node dist/main.js add "Learn TypeScript"
  node dist/main.js done 2
  node dist/main.js list
  if node dist/main.js remove 9; then echo "expected 'remove 9' to fail"; exit 1; fi
)

echo "== link-checker =="
(
  cd link-checker
  npm ci
  npm test
)

echo "== file-indexer =="
(
  cd file-indexer
  npm ci
  npm test
  # Output must not depend on the thread count.
  one="$(node dist/main.js -j 1 src 2>/dev/null)"
  four="$(node dist/main.js -j 4 src 2>/dev/null)"
  if [ "$one" != "$four" ]; then echo "output differs between -j 1 and -j 4"; exit 1; fi
)

echo "All capstones OK"
