# Rule: bot coordination

Full rules: the "Multi-bot coordination" section of `AGENTS.md`. The short version:

- One GitHub issue per task, assigned to exactly one bot. Check the assignee (and the `bot:*` label) before you start. Not yours: comment, do not work on it.
- Area owners: Avuny-Bot-001 owns sales, purchasing, vendor bill and payment, ops. Claude Code owns costing and assembly. Do not edit another bot's area without a comment on its issue and a reply.
- Cross-bot notes go in issue comments. Every PR links its issue and targets `dev`.
- Merge or rebase the latest `dev` before finalizing a PR. Migration numbers must come after the latest on `dev` at that moment.
- Releases to `main` need the owner's OK each time.
