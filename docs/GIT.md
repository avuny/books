## Git Commit Message Guidelines

When asked to review Git changes or suggest a commit message:

1. Inspect `git status`, `git diff`, and `git diff --cached` to understand the working tree and staged changes. Inspect relevant untracked files when necessary.
2. Understand the actual changes before describing them. Never guess the purpose or claim behavior that is not supported by the code.
3. Use Conventional Commits when appropriate: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, or `chore`.
4. Write a concise subject, ideally under 72 characters, using the imperative mood.
5. Add a moderately detailed body that explains the main changes and important implementation details. Use 3–6 bullets when multiple points warrant explanation; do not force bullets for simple changes.
6. Group related changes logically instead of listing every modified file. Mention important architectural, behavioral, or configuration changes when relevant.
7. Keep the message informative but concise. Avoid repetition, vague descriptions, and unnecessary implementation details.
8. **Always split commits by logical change:** When the working tree contains multiple distinct changes (e.g. features, bug fixes, documentation, configuration, or agent instructions), split them into separate atomic commits. Never bundle unrelated logical changes into a single commit.
9. **Provide staging commands for each commit:** For every split commit, provide the exact `git add` command specifying only the files belonging to that change, paired immediately with its proposed commit message in a copy-ready Markdown code block.
10. Do not modify files, stage changes, create commits, or run destructive Git commands when only asked to review changes or suggest commit messages.

Output each proposed commit with its staging `git add` command and commit message in a Markdown code block, ready to copy and run in Git.
