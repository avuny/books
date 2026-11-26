# Feature tracking, monitoring and documentation

Goal: any agent or developer can create, resume, refactor or audit a module from files alone, and the owner can see status at a glance.

## 1. Source of truth per question

| Question | Where |
|---|---|
| What is this module meant to do? | `docs/modules/<name>/SPEC.md` (versioned, changes only through a recorded deviation) |
| What is the order of work and what is done? | `docs/modules/<name>/PROGRESS.md` (task table, gates, verification log, decision log, Next action) |
| How is it tested? | `docs/modules/<name>/TEST-PLAN.md` |
| What is the status of everything? | `docs/features/REGISTRY.md` (one row per module) |
| Why was a decision made? | decision log in PROGRESS.md; cross-module ones in `docs/decisions/NNNN-title.md` |
| What is broken? | GitHub issues labeled `bug`, with the audit id or test name; audits in `docs/audits/` |
| Build order across modules | `docs/modules/COMMERCE-IMPLEMENTATION-PLAN.md`, `docs/modules/IMPLEMENTATION-PLAN.md` (SaaS) |

## 2. Lifecycle of a module

1. **Propose**: copy `docs/templates/MODULE-SPEC.md`, fill it, add a REGISTRY row with status `proposed`.
2. **Plan**: copy `MODULE-PROGRESS.md` and `TEST-PLAN.md` templates, phases and gates as in `docs/modules/party/PROGRESS.md`. Status `planned`.
3. **Build**: follow `.agents/workflows/new-module.md` and the PROGRESS resume protocol. Status `in-progress`. One commit per task or small group (docs/GIT.md).
4. **Gate**: a phase ends only when every gate item is ticked with evidence (command and result) in the verification log.
5. **Ship**: all gates green, e2e and integration tests merged, locales complete, REGISTRY row `done`, version noted in the changelog.
6. **Change later**: update SPEC first (new version line and a Deviations entry), then PROGRESS, then code. Refactors add a PROGRESS section "Refactor YYYY-MM-DD" with the reason and the tests that guard behavior.

## 3. Rules for agents

- Read AGENTS.md, then the module SPEC and PROGRESS, before editing. Continue at "Next action".
- Never tick a task without evidence. Never silently change SPEC; log a deviation.
- Update PROGRESS "Last updated", counts, status board and Next action in the same commit as the work.
- Do not edit another module's tables or services directly; use its exported service or add a task in its PROGRESS.
- Open questions go into the decision log marked `open` with a recommended default; do not block on them unless the SPEC says so.

## 4. Monitoring

Tracking in production, in order of effort:

1. **Cloudflare**: `observability.enabled` is already on for the API worker. Keep structured logs (`packages/logger`) with `requestId`, `orgId`, `userId`, route and error code. Never log secrets or tokens.
2. **Error tracking**: add Sentry (or similar) to the worker and the web app, tagged with release (git sha) and org id. Alert on new error groups and on 5xx rate.
3. **Uptime and smoke**: `/api/health` check every minute from an external monitor, plus the post-deploy smoke test (TESTING-PLAN section 6) and a scheduled run once a day.
4. **Business invariants** (nightly job, per org): stock projection equals sum of stock movements; journal entries balance; AR/AP subledger equals control account; no document in `posting` state for over 10 minutes. Failures write to the activity log and alert.
5. **Audit trail**: every mutation writes an activity-log entry; module TEST-PLAN checks it.
6. **Feature usage**: log a `feature.used` event per module action (counts only) to see adoption and feed the SaaS feature gate.
7. **CI health**: tests.yml required on PRs; flaky e2e are fixed or quarantined with an issue in one week.

## 5. Documentation duties per change

- User-facing text only in contracts locales (en and ar).
- API: OpenAPI is generated; run `pnpm openapi:generate` and `pnpm api:generate`, commit the output.
- A short module README is not needed; SPEC and PROGRESS are the docs. Keep both current.
- Changelog: Conventional Commits drive `scripts/release.sh`.
