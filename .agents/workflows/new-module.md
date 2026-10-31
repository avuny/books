# Workflow: build a new module end to end

Use this when asked for "a new module for X" (example below: **project**). Do the phases **in order**; each ends with a gate. Open the linked skill at the start of the phase.

## Phase 0 — Clarify (5 minutes, max one round of questions)

Write down, in the PR description or your plan:

| Question | Example answer |
|---|---|
| Module name (singular, kebab) | `project` |
| Fields + limits | `name` 2–80, `description` ≤500, `status` draft/active/archived |
| Scope | per organization (`orgId` in every path) |
| Endpoints | list, get, create, update, delete (+ archive) |
| Who can do what | actions `create/read/update/delete/archive` on resource `project` |
| Plan limits? | max projects per plan → `PROJECT_LIMIT_REACHED` |
| UI surfaces | list page, details page, create/edit dialog |
| Business rules visible in UI | can't delete while it has members |

If an answer is missing, pick the default in the right column and state it as an assumption.

## Phase 1 — Contracts → `skills/contracts-module`
`constants.ts`, `errors.ts`, `schemas.ts`, `index.ts`, `locales/en.json` + `ar.json` (errors/labels/msgs).
**Gate:** locale parity script passes with `--errors`; contracts build.

## Phase 2 — Backend core ⚠ (no skill: follow neighbouring modules)
DB table (Drizzle) + migration, `<module>.errors.ts` (code → HTTP status + msg key), `<module>.service.ts` returning `Result` (permission → plan limit → rules → write → audit event).
**Gate:** service unit tests for forbidden / not found / happy path.

## Phase 3 — RBAC → `skills/rbac-permissions`
Catalog entry, `SYSTEM_ROLES` update, `labels.resources.project` + actions in both locales.
**Gate:** `canAccess` covered by a test for allow, deny, and no-statement.

## Phase 4 — API routes → `skills/api-hono-routes`
`_shared.ts`, one route file per endpoint, `hono-routes/index.ts`, mount in app router. Regenerate the client.
**Gate:** OpenAPI shows each `operationId`; typecheck; web `@/api` exports `useListProjects`, `useCreateProject`, …

## Phase 5 — Web feature → `skills/web-feature-module`
types → `project-api.ts` (+test) → lib → components → forms → list → details → barrels.
**Gate:** `@/api` imported only in `project-api.ts`; no `useTranslation` in pure views; vitest passes.

## Phase 6 — UI strings → `skills/locales`
Add the web string map (`list.*`, `create.*`, …) for **en and ar**.
**Gate:** parity script; no hard-coded strings (`grep -rn '>[A-Z][a-z]' features/project-module` as a smoke test).

## Phase 7 — Routes → `skills/web-routes`
`projects/index.tsx`, `projects/$projectId.tsx`, optional singular redirect; add the nav entry.
**Gate:** route tree regenerates; clicking list → details → back works.

## Phase 8 — Verify
- `typecheck`, `lint`, `test` green ⚠ commands in `AGENTS.md`.
- Manual: create, edit, delete (with and without the blocking rule), search, tabs, pagination, empty state, a forbidden user (buttons hidden **and** server returns 403), Arabic/RTL.
- Definition of done in `AGENTS.md` §6 fully ticked.

## Prompt template for humans delegating to an agent

```
Build the <project> module following AGENTS.md and .agents/workflows/new-module.md.
Fields: name (2–80), description (≤500), status (draft|active|archived).
Endpoints: list/get/create/update/delete under /organizations/{orgId}/projects.
Permissions: resource "project", actions create/read/update/delete; Team manager gets all.
UI: list with status tabs + search, details page, create/edit dialog, delete confirm.
Plan limit: PROJECT_LIMIT_REACHED. Locales: en + ar.
Stop after each phase gate and summarize what you changed.
```

## Mapping cheat-sheet (what name goes where)

| Thing | Name |
|---|---|
| Contracts folder | `project/` |
| Error codes | `PROJECT_NOT_FOUND`, `PROJECT_FORBIDDEN`, … |
| Schemas / types | `CreateProjectSchema` / `CreateProjectInput`, `ProjectDtoSchema` / `ProjectDto` |
| Route file | `create-project.route.ts` → `createProjectRoute` |
| `operationId` | `createProject` → web `useCreateProject` |
| Router export | `projectRoutes` |
| Service | `projectService.create(userId, orgId, body)` |
| Permission key | `create:project` |
| Web feature folder | `features/project-module/` |
| Web api hooks | `useProjectList`, `useProject`, `useCreateProjectMutation` |
| i18n namespace | `project` |
| Route files | `routes/organization/$orgId/projects/{index,$projectId}.tsx` |
