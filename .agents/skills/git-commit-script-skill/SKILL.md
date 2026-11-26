---
name: git-commit-script
description: Create safe, reviewable shell scripts that split a Git working tree into logical Conventional Commit commits.
---

# Git Commit Script Skill

## Purpose

Use this skill when the user asks to turn a set of Git changes into a sequence of well-organized commits, or asks for a copy-pasteable shell script that stages specific paths and commits them in groups.

The goal is to produce a **reviewable, deterministic commit plan** that preserves the user's work and creates a useful project history.

## Required workflow

### 1. Inspect the repository before planning

When terminal access is available, inspect the repository before writing commands:

```sh
git status --short
git diff --stat
git diff --cached --stat
git diff --name-status
git diff --cached --name-status
```

Inspect relevant diffs when file purpose or change intent is unclear. Include untracked files in the inventory; `git diff` does not show untracked file contents, so inspect them separately when needed.

Do not infer a file's purpose from its name alone when its contents or surrounding architecture matter.

If repository access is unavailable, work only from the paths and descriptions the user supplied. Do not claim to have inspected files or verified commands.

### 2. Build logical commit groups

Group changes by **one coherent intent**, not merely by directory. Common boundaries include:

- contracts, schemas, validation, constants, and localization;
- database schema and migrations;
- shared server infrastructure or helpers;
- one backend domain module per commit;
- route registration or application wiring;
- frontend shared infrastructure;
- one frontend feature per commit;
- route/page integration;
- build, tooling, or repository configuration;
- formatting-only changes, kept separate and optional.

Keep tightly coupled files together. Examples:

- A database migration and its Drizzle journal entry belong in the same commit.
- A module's implementation, tests, and specification usually belong together.
- A generated route tree belongs with the route changes that caused it.
- A formatting-only change should not be mixed into a functional feature commit when it can be isolated cleanly.

Avoid both extremes: do not create one enormous commit for unrelated work, and do not create many tiny commits that split a single coherent change without a clear reason.

### 3. Write commit messages

Use Conventional Commits unless the repository or user specifies another convention:

```text
<type>(<scope>): <imperative summary>

- Explain the important implementation details.
- Mention relevant constraints, behavior, or tests.
```

Choose types accurately:

- `feat`: adds user-visible or system capability.
- `fix`: corrects a bug.
- `refactor`: changes structure without intended behavior change.
- `test`: adds or changes tests only.
- `docs`: documentation-only changes.
- `style`: formatting or whitespace only, with no behavior change.
- `build`: build scripts or build configuration.
- `chore`: maintenance that does not fit a more specific type.

Use a scope when it adds clarity. Keep the subject concise and imperative. Do not label a functional change `style` or a structural refactor `feat` merely because files were moved.

Commit bodies should describe what the commit actually contains. Do not invent tests, behavior, or implementation details.

### 4. Protect the user's index and working tree

The generated script must follow these safety rules:

1. **Never use destructive cleanup commands** such as `git reset --hard`, `git clean`, `git checkout --`, or `git restore` to discard work.
2. Do not run `git reset -q` by default. It unstages the index, even though it leaves working-tree edits intact.
3. By default, abort if the index already contains staged changes. This prevents unrelated staged work from silently entering the first generated commit:

   ```sh
   if ! git diff --cached --quiet; then
     printf '%s\\n' 'Error: staged changes already exist. Review or unstage them before running this script.' >&2
     exit 1
   fi
   ```

4. If the user explicitly asks to unstage everything first, explain that `git reset -q` changes the index, then include it only with that explicit authorization.
5. Stage only the paths assigned to each commit. Never use a blanket `git add -A` at repository root unless the user explicitly asks to commit the entire working tree.
6. Use `git add -A -- <paths>` for a defined group when additions, modifications, and deletions/moves in those paths must all be included.
7. Quote paths, especially paths containing spaces, `$`, parentheses, brackets, or other shell metacharacters. For example:

   ```sh
   git add -A -- 'apps/web/src/routes/organization/$orgId/items/'
   ```

8. Do not use `git commit --amend`, force-push, or push unless explicitly requested.
9. Use `set -e` so the script stops when a staging or commit command fails. Do not hide failures with `|| true`.
10. Do not claim the script was executed or that commits succeeded unless that actually happened.

### 5. Make scripts safe to paste into interactive Zsh

The user may paste the generated block directly into an interactive `zsh` terminal. Zsh does not enable interactive comments by default on every installation, so a pasted standalone line beginning with `#` can be interpreted as a command and produce `zsh: command not found: #`.

For a **copy-paste block**:

- Omit standalone comment lines from the executable block.
- Do not place explanatory headings such as `# 1 — database` between commands.
- Put explanations outside the code block, or use a separate numbered commit plan.
- Use a subshell when appropriate so shell options or temporary variables do not affect the user's current shell:

  ```sh
  (
  set -e
  # commands, but no standalone comments in the final paste-ready block
  )
  ```

- Preserve line breaks. Tell the user to paste the block as-is, not convert it to one line.

For a **saved script file**, comments and a shebang are fine. Prefer a portable Bash script with `#!/usr/bin/env bash`, then instruct the user to run it explicitly with `bash ./path/to/script.sh`. Do not present a Bash script containing Bash-only syntax as if it were a native Zsh script.

Do not assume that wrapping a block in parentheses makes `#` comments safe in interactive Zsh; it does not.

### 6. Structure the generated script

A typical paste-ready script should:

- run in a subshell;
- enable fail-fast behavior with `set -e`;
- verify it is being run inside a Git repository;
- verify the index is clean, unless the user explicitly authorized a different policy;
- stage one logical group at a time;
- create one commit immediately after staging that group;
- finish by displaying repository status and the newly created commits.

Example safety preamble:

```sh
(
set -e

git rev-parse --show-toplevel >/dev/null

if ! git diff --cached --quiet; then
  printf '%s\\n' 'Error: staged changes already exist. Review or unstage them first.' >&2
  exit 1
fi

# Add each stage-and-commit group here.

git status --short
git log --oneline -10
)
```

When producing a paste-ready Zsh block, remove the comment line from this example. The comment is explanatory only.

Use one `git add` followed by one `git commit` for each group. Example:

```sh
git add -A -- 'packages/contracts/src/unit' 'packages/contracts/src/item'
git commit -m 'feat(contracts): add unit and item contracts' -m '- Add schemas and validation.
- Add module constants and tests.'
```

Use `git add -- <paths>` when the intended staging behavior is sufficient for the known changes; use `-A` when deletions must also be captured. Do not add exclusion pathspecs unless the excluded file is deliberately meant to stay out of that commit, and verify the pathspec syntax.

### 7. Validate before presenting

Before returning the script:

- Check that every intended changed path appears in exactly one commit group, unless intentionally shared across commits.
- Check that no path is accidentally omitted, duplicated, or staged too early.
- Check quoting of all shell-sensitive paths, especially TanStack route paths such as `$orgId`.
- Check each `git add` pathspec and each commit command for valid shell syntax.
- Check that the commit order follows dependencies (for example, contracts before consumers, schema/migrations before server modules, and feature implementation before route wiring where appropriate).
- Check that the final commit count matches the planned groups.
- Make clear whether formatting-only commits are optional.
- If you have not run the script, say it is prepared but not executed.

Do not add commands that push to a remote. Do not promise that tests pass unless they were actually run.

## Response format

When the user asks for the script itself:

1. Give one sentence explaining whether it is intended to be pasted into the terminal or saved and executed as a file.
2. Provide one complete code block, not fragmented snippets.
3. Include all required commands and preserve meaningful line breaks.
4. Briefly call out any consequential behavior, especially whether staged changes are required to be absent or will be unstaged.
5. Do not bury the executable block among several alternative versions unless the user asks for alternatives.

When the user asks for a commit plan rather than a script, show the ordered commit subjects and the paths in each group before generating commands.

## Important distinction

A successful `git add` only stages changes; a successful `git commit` records them. A script using `set -e` stops on the first failed command, so later groups will not be committed. `git status --short` at the end shows any remaining unstaged or untracked changes; an empty result means the working tree is clean.
