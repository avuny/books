#!/usr/bin/env bash
set -euo pipefail

# Mark untracked files as intent-to-add so they show up in the diff
git ls-files --others --exclude-standard -z | while IFS= read -r -d '' file; do
  git add -N -- "$file"
done

diff_output=$(git diff -- "${@:-.}" ':(exclude)*_snapshot.json' ':(exclude)apps/web/src/routeTree.gen.ts')

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s\n' "$diff_output" | pbcopy
elif command -v wl-copy >/dev/null 2>&1; then
  printf '%s\n' "$diff_output" | wl-copy
elif command -v xclip >/dev/null 2>&1; then
  printf '%s\n' "$diff_output" | xclip -selection clipboard
elif command -v xsel >/dev/null 2>&1; then
  printf '%s\n' "$diff_output" | xsel --clipboard --input
else
  echo "No clipboard tool found (install xclip, xsel or wl-clipboard)" >&2
  exit 1
fi