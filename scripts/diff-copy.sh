#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILL_FILE="$REPO_ROOT/.agents/skills/git-commit-script-skill/SKILL.md"

# Mark untracked files as intent-to-add so they show up in the diff
git ls-files --others --exclude-standard -z | while IFS= read -r -d '' file; do
  git add -N -- "$file"
done

diff_output=$(git diff -- "${@:-.}" ':(exclude)*_snapshot.json' ':(exclude)apps/web/src/routeTree.gen.ts')

skill_content=""
if [[ -f "$SKILL_FILE" ]]; then
  skill_content="$(cat "$SKILL_FILE")"
fi

if [[ -n "$skill_content" && -n "$diff_output" ]]; then
  output="${skill_content}"$'\n\n'"${diff_output}"
elif [[ -n "$skill_content" ]]; then
  output="$skill_content"
else
  output="$diff_output"
fi

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s\n' "$output" | pbcopy
elif command -v wl-copy >/dev/null 2>&1; then
  printf '%s\n' "$output" | wl-copy
elif command -v xclip >/dev/null 2>&1; then
  printf '%s\n' "$output" | xclip -selection clipboard
elif command -v xsel >/dev/null 2>&1; then
  printf '%s\n' "$output" | xsel --clipboard --input
else
  echo "No clipboard tool found (install xclip, xsel or wl-clipboard)" >&2
  exit 1
fi
