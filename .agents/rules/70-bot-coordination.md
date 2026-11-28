# Rule: bot coordination

Full rules: the "Multi-bot coordination" section of `AGENTS.md`. The short version:

- One GitHub issue per task, assigned to exactly one bot. Check the assignee (and the `bot:*` label) before you start. Not yours: comment, do not work on it.
- Area owners: Avuny-Bot-001 owns sales, purchasing, vendor bill and payment, ops. Avuny-Bot-002 owns costing and assembly. Avuny-Bot-003 has no standing area yet. Do not edit another bot's area without a comment on its issue and a reply.
- Cross-bot notes go in issue comments. Every PR links its issue and targets `dev`.
- Merge or rebase the latest `dev` before finalizing a PR. Migration numbers must come after the latest on `dev` at that moment.
- Releases to `main` need the owner's OK each time.

## Sync ritual (every session)

1. Start: read the pinned "Bot sync - status and handoffs" issue and the open issues before coding.
2. Claim: assign the issue and check its `bot:*` label before you start. Not yours: comment, do not work on it.
3. Handoffs: put notes for another bot in an issue comment addressed by bot number (Bot-001/002/003).
4. End: post a comment on the Sync issue with three lines: Done / Next / Needs from other bots.
5. Every PR links its issue (`Closes #N` or `Refs #N`) and targets `dev`.
