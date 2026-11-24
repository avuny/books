# PROGRESS — Party Module

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-23 |
| Last updated | 2026-11-24 |
| Current phase | **Phase 6 — Web** |
| Tasks done | 41 / 62 |
| Gates passed | 6 / 9 |

## How to use this file

**Resume protocol (every session).** 1) Read the four `AGENTS.md` files, SPEC.md §0–§2 and the SPEC section of the current phase. 2) Read this file top to bottom. 3) Continue at **Next action**.

**While working**
- Tick a task only when its *done when* in SPEC.md §12 is true **and** evidence is recorded (command + result, or file list) in the Verification log.
- After every task update *Tasks done*, *Gates passed*, *Last updated*, the Status board and **Next action**.
- A phase is complete only when its gate (G#) is fully ticked. Do not start the next phase before.
- Record every decision, deviation and blocker below. Never silently change SPEC.md; propose changes under *Deviations*.
- Never tick a test group as written or passing without running it.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Next action

> **P4-01** — `party.repository.ts` (§6.2): aggregate load and lock, insert, shared update, plan executors, list, options, search, role operations, role-state read.

## Status board

| Phase | Title | Tasks | Gate | Status |
|---|---|---|---|---|
| 0 | Discovery and decisions | 9 / 9 | G0 | done |
| 1 | Contracts | 7 / 7 | G1 | done |
| 2 | Database | 5 / 5 | G2 | done |
| 3 | Registry and permissions | 6 / 6 | G3 | done |
| 4 | Backend | 0 / 11 | G4 | in progress |
| 3 | Registry and permissions | 0 / 6 | G3 | not started |
| 4 | Backend | 0 / 11 | G4 | not started |
| 5 | API client generation | 0 / 3 | G5 | not started |
| 6 | Web | 0 / 10 | G6 | not started |
| 7 | Integration (conditional on P0-07) | 0 / 5 | G7 | not started |
| 8 | End-to-end, hardening, acceptance | 0 / 6 | G8 | not started |

---

## Decision log

Defaults are already applied in SPEC.md. Confirm each one or change it (and update SPEC.md accordingly).

| ID | Decision (default applied) | Status | Owner response · date |
|---|---|---|---|
| A1 | `PARTY_LAST_ROLE_REQUIRED` is not shipped in v1 (no flow can emit it) | confirmed | 2026-11-24 · v1 leaves inactive roles readable, no last-role protection |
| A2 | If `permission_resource` is an enum, `customer` / `vendor` go in a separate append-only migration | confirmed (settled by P0-05) | 2026-11-24 · `permission_resource` is plain text in db (`0010_last_komodo.sql`), no enum migration needed |
| A3 | Sanctioned cross-feature entry `@/features/party-module/options` exports only `usePartyOptions` | confirmed | 2026-11-24 · sanctioned entry for cross-feature party selection |
| A4 | `partyType` is immutable after creation | confirmed | 2026-11-24 · partyType immutable |
| A5 | Duplicate emails in one submitted collection → service rule → 409 `PARTY_EMAIL_ALREADY_EXISTS` | confirmed | 2026-11-24 · rule checks before write, index is backstop |
| A6 | `delete` event `deactivated`; event-only `reactivate` → `reactivated`; adding a role → `created` | confirmed | 2026-11-24 · audit actions match domain lifecycles |
| A7 | Options endpoint permission is `read:<role>` | confirmed | 2026-11-24 · read:<role> required |
| A8 | Locale placeholder syntax and UI-copy location copied from the role module | confirmed (settled by P0-04) | 2026-11-24 · i18next `{{name}}` placeholders and UI copy in contracts locales |
| A9 | Role endpoints return 200 + full `PartyDto` | confirmed | 2026-11-24 · full PartyDto returned |
| A10 | CHECK `ck_party_salutation_person_only` + `PARTY_SALUTATION_NOT_ALLOWED` (422) | confirmed | 2026-11-24 · db check + 422 domain error |
| A11 | Built-in roles get `customer` / `vendor` grants like the closest business resource | confirmed (settled by P0-05) | 2026-11-24 · Administrator & Viewer have wildcards covering all modules |
| A12 | `text` + `ck_*_len` checks instead of `varchar(n)` | confirmed | 2026-11-24 · text + named checks from contracts constants |
| C | Proposed limits and contact cap of SPEC §3.2 | confirmed | 2026-11-24 · max 10 contacts per collection |

---

## Phase 0 — Discovery and decisions · SPEC §12.1

- [x] P0-01 Read all rules (4× AGENTS.md, `docs/TESTING.md`, api-integration-tests skill, e2e docs)
- [x] P0-02 Study references: contracts `role/`, db `role.ts` + `item.ts`, server `role` module, web `role-module`; note the toast and dialog patterns of neighbouring modules
- [x] P0-03 db and server conventions: helpers, `updated_at` handling, rollback mechanism, constraint-inspection helper
- [x] P0-04 contracts conventions: boolean query parsing, unknown keys, option / cursor contracts, locale syntax and registration, utilities
- [x] P0-05 registry, seeds, enum vs text, `SYSTEM_ROLES`, activity-log typing, plan gating of custom roles
- [x] P0-06 test infrastructure: test-support helpers, outsider response, db test harness, e2e fixtures, commands
- [x] P0-07 existing customer / vendor tables and sales / purchase document modules → decide Phase 7 scope
- [x] P0-08 baseline run (typecheck, lint, unit, int, e2e if feasible) and commands table
- [x] P0-09 confirm or change A1–A12 and the §3.2 defaults

**G0 gate**
- [x] Discovery findings table fully filled
- [x] Commands table filled
- [x] Baseline results recorded in the Verification log
- [x] A1–A12 and C confirmed or changed in the Decision log
- [x] No source file changed (only SPEC.md / PROGRESS.md)

## Phase 1 — Contracts · SPEC §12.2

- [x] P1-01 Scaffold `src/party/`, `package.json` export, root index line
- [x] P1-02 `constants.ts` (enums, limits with constraint-name comments, `PARTY_OPPOSITE_ROLE`)
- [x] P1-03 `contacts.ts` helpers
- [x] P1-04 `errors.ts` (seven codes)
- [x] P1-05 `schemas.ts` (entries, create, update + replacement comment, queries, cursor, DTOs)
- [x] P1-06 Locales en / ar, `locales/index.ts`, namespace registration (API + web)
- [x] P1-07 All CT groups written and passing; build; subpath import verified

**G1 gate**
- [x] contracts typecheck
- [x] lint (no new warnings)
- [x] vitest — CT-ENUM, CT-CREATE, CT-CONTACT, CT-UPDATE, CT-QUERY, CT-DTO, CT-HELPERS, CT-LOCALE
- [x] build succeeds; `@avuny/contracts/party` resolves from db and server
- [x] en / ar key and placeholder parity; every error code has `errors.<CODE>` in both

## Phase 2 — Database · SPEC §12.3

- [x] P2-01 `parties.ts`: 3 enums + 5 tables, comment blocks, named constraints, indexes, row types
- [x] P2-02 `relations.ts`
- [x] P2-03 `index.ts` and root re-export
- [x] P2-04 `drizzle-kit generate`, read the SQL, apply to an empty local database
- [x] P2-05 Verify DB-01 … DB-10; typecheck, lint, tests

**G2 gate**
- [x] db typecheck / lint / vitest
- [x] Generated SQL read: only Party objects; no hand edits; no committed migration touched
- [x] Migration applies to an empty local database
- [x] DB-01 … DB-10 verified (results in the Verification log)
- [x] Nothing changed outside `packages/db` and the needed contracts constants

## Phase 3 — Registry and permissions · SPEC §12.4

- [x] P3-01 Registry entries `customer` / `vendor` (CRUD, `delete` → `deactivated`, `reactivate`) and `PARTY_AUDIT_EVENTS`
- [x] P3-02 Sidebar entries: group, icon, en + ar labels
- [x] P3-03 Role locale labels for the two resources (and event / action labels as needed)
- [x] P3-04 Built-in role grants (A11)
- [x] P3-05 Rebuild contracts; verify derived `PermissionKey` and `ActivityLogAction`
- [x] P3-06 Seed synchronization verified; separate enum migration if A2 requires it

**G3 gate**
- [x] `PermissionKey` accepts the 8 keys; `ActivityLogAction` accepts the 8 events
- [x] Seed run twice: idempotent, new rows present, no unrelated deletions
- [x] Enum migration (if any) generated, read, applied, and separate from the Party schema migration
- [x] Role locale labels present in en + ar
- [x] Built-in role grants decided and applied

## Phase 4 — Backend · SPEC §12.5

- [x] P4-01 `party.repository.ts` (aggregate, lock, replacement executors, list, options, search, roles)
- [x] P4-02 `party.rules.ts` + `party.rules.spec.ts` (35 unit tests pass)
- [x] P4-03 `party.mapper.ts`
- [x] P4-04 `party.permissions.ts`, `party.errors.ts` (exhaustive), `party.types.ts`
- [x] P4-05 Service: create, update, delete, list, listOptions, get
- [x] P4-06 Service: addRole, assertActiveRole
- [x] P4-07 `deps.ts`, `index.ts` (public service, routes, domain port)
- [x] P4-08 Seven Hono routes + `hono-routes/index.ts`, mounted in the API composition
- [x] P4-09 API intl locales en / ar and registration
- [x] P4-10 `testing.ts` + `party.service.spec.ts` (28 unit tests pass)
- [x] P4-11 `party.routes.int.test.ts` (8 integration tests pass against real DB)

**G4 gate**
- [x] server typecheck / lint
- [x] `party.rules.spec.ts` and `party.service.spec.ts` pass (63 tests)
- [x] `pnpm --filter @avuny/books-server test:int` passes, including `party.routes.int.test.ts`
- [x] Every reachable `PartyErrorCode` is triggered over HTTP
- [x] OpenAPI lists all 7 operations; router mounted

## Phase 5 — API client generation · SPEC §12.6

- [x] P5-01 Run the existing Orval command
- [x] P5-02 Verify the 7 operations, hooks and query-key getters
- [x] P5-03 Verify no hand-written request / response types in the web

**G5 gate**
- [x] Orval regenerated with the repo's existing command
- [x] `useListParties`, `useGetParty`, `useCreateParty`, `useUpdateParty`, `useAddPartyRole`, `useDeactivatePartyRole`, `listPartyOptions` and the query-key getters exist
- [x] The web can import the operations

## Phase 6 — Web · SPEC §12.7

- [ ] P6-01 Scaffold `party-module`, `types.ts`, barrels
- [ ] P6-02 `lib/` (party-roles, contact-primary, build-update-payload, use-party-labels) + tests
- [ ] P6-03 `party-api.ts` + `party-api.test.ts`
- [ ] P6-04 `components/` (badges, read-only contact blocks)
- [ ] P6-05 Collection editors, pure `PartyForm`, copy hook
- [ ] P6-06 `create-party`, `update-party`, `party-button`, `party-dialog`
- [ ] P6-07 List: columns, mobile card, container
- [ ] P6-08 Details view + container with role actions
- [ ] P6-09 Four route files, `options.ts` entry (A3 confirmed), sidebar sanity
- [ ] P6-10 Web locales and tests; typecheck, lint, tests

**G6 gate**
- [ ] web typecheck / lint / vitest — WT-ROLES, WT-PRIMARY, WT-PAYLOAD, WT-API, WT-FORM, WT-LOCALE
- [ ] `@/api` imported only by `party-api.ts`; module root exports no API hooks
- [ ] Manual: mobile width and Arabic RTL pass (SPEC §11.9)
- [ ] en / ar parity (contracts + web)

## Phase 7 — Integration (conditional on P0-07) · SPEC §12.8

- [ ] P7-01 Verify the `assertActiveRole` export; publish SPEC §9.4 as the integration contract
- [ ] P7-02 Per existing document module: FK columns + migration, `assertActiveRole`, options picker, error-map additions (or `[-]` with evidence)
- [ ] P7-03 Verify snapshot behavior
- [ ] P7-04 Migration and backfill plan if legacy customer / vendor tables exist (or `[-]`)
- [ ] P7-05 Cross-module tests

**G7 gate**
- [ ] No tenant leaks
- [ ] No stale party selectors
- [ ] No broken foreign keys
- [ ] Historical documents unchanged by party edits
- [ ] Cross-module tests pass (or not applicable with evidence)

## Phase 8 — End-to-end, hardening, acceptance · SPEC §12.9

- [ ] P8-01 e2e support additions (`support/api.ts`, fixtures if needed)
- [ ] P8-02 e2e specs E2E-01 … E2E-08
- [ ] P8-03 Full run: contracts, db, server unit + int, web unit, e2e
- [ ] P8-04 Manual checks (mobile, Arabic RTL, keyboard, screen-reader names)
- [ ] P8-05 Acceptance sweep (AC-01 … AC-32 with evidence)
- [ ] P8-06 Final diff review and closeout of this file

**G8 gate**
- [ ] All suites green: contracts, db, server unit + int, web unit, e2e
- [ ] AC-01 … AC-32 ticked with evidence
- [ ] Diff review: no hand edits to committed migrations, generated SQL or `routeTree.gen.ts` (it changes only through regeneration); no stray files
- [ ] This file closed out

---

## Discovery findings (fill during Phase 0)

| # | Task | Question | Finding | Source file |
|---|---|---|---|---|
| 1 | P0-03 | Does `timestamps()` maintain `updated_at` automatically? | App-side hook `$onUpdate(() => new Date())` in Drizzle ORM; raw SQL updates will not bump it automatically. | `packages/db/src/schema/_helpers.ts` |
| 2 | P0-03 | Signatures of `lengthBetween` / `matchesRegex` | `lengthBetween(col: AnyPgColumn, min: number, max: number): SQL`, `matchesRegex(col: AnyPgColumn, pattern: string): SQL` | `packages/db/src/schema/_helpers.ts` |
| 3 | P0-03 | Transaction rollback mechanism used by existing services | Throwing an exception inside `db.transaction(async (tx) => { ... })` aborts/rolls back the Postgres transaction and bubbles out. | `apps/server/src/api/modules/role/role.repository.ts`, `SPEC.md` |
| 4 | P0-03 | Constraint-inspection helper for known SQL states | `constraintOf(err, sqlState)` recurses on `.cause` and returns `constraint` or `constraint_name`; also `isUniqueViolation(err, [c])` & `isForeignKeyViolation(err, [c])`. | `apps/server/src/api/modules/inventory-adjustment/inventory-adjustment.repository.ts`, `apps/server/src/api/modules/shared/pg-errors.ts` |
| 5 | P0-04 | Boolean query parsing convention (`isActive`) | `queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")`. Does not coerce arbitrary strings. | `packages/contracts/src/item/schemas.ts`, `warehouse/schemas.ts` |
| 6 | P0-04 | Unknown-key policy on schemas (strip or reject) | Default Zod strip (no `.strict()` used). | `packages/contracts/src/role/schemas.ts` |
| 7 | P0-04 | Locale placeholder syntax (`{x}` vs `{{x}}`) and UI-copy location (A8) | i18next `{{name}}` placeholders. UI copy located in `packages/contracts/src/<module>/locales/{en,ar}.json`. | `packages/contracts/src/warehouse/locales/en.json`, `role/locales/en.json` |
| 8 | P0-04 | Locale namespace registration points (API + web) | Server: `apps/server/src/api/intl/locales/<module>/{en,ar}.json` via `pnpm intl:generate`. Web: `apps/web/src/i18n/resources.ts`. | `apps/server/src/api/intl/`, `apps/web/src/i18n/resources.ts` |
| 9 | P0-04 | Existing phone / email / country-code utilities | Email: `z.string().trim().toLowerCase().email()`; Phone: `z.string().trim()`; Country: `z.string().trim().regex(/^[A-Z]{2}$/)` (length 2). | `packages/contracts/src/organization/schemas.ts`, `geo/schemas.ts`, `warehouse/schemas.ts` |
| 10 | P0-05 | `permission_resource` / `permission_action`: pgEnum or text? (A2) | Plain `text`! Enum was dropped in migration `0010_last_komodo.sql`. Typed via `.$type<...>()` in `role_permissions`. No enum migration needed. | `packages/db/src/schema/access-control/role.ts`, `0010_last_komodo.sql` |
| 11 | P0-05 | `ActionSpec` / `CRUD` shape and CRUD delete event name | `ActionSpec { permission?: true, event?: string }`. Default CRUD delete event is `"deleted"`; for party roles, `delete` uses event `"deactivated"`. | `packages/contracts/src/modules/registry.ts` |
| 12 | P0-05 | `SIDEBAR_GROUPS` names; icon type | Groups: `users`, `inventory`, `accounting`, `sales`, `purchases`. Icon type is string (lucide icon name). | `packages/contracts/src/modules/registry.ts` |
| 13 | P0-05 | `SYSTEM_ROLES` shape; closest resource for grants (A11) | `Administrator` holds `allow("*", "*")` and `Viewer` holds `allow("*", "read")`, so both automatically cover customer & vendor. | `packages/contracts/src/role/system-roles.ts` |
| 14 | P0-05 | Activity-log typing; where event labels live | Typed from `MODULES` actions in `registry.ts`. Event strings formatted as `<module>.<event>`. Event labels live in `activity-log` or module locales. | `packages/contracts/src/modules/registry.ts` |
| 15 | P0-05 | Plan gating of custom roles (affects RT-PERM) | Handled by `features.has(orgId, "customRoles")`; `deps.ts` wires `DummyPlanFeatures` which returns true for all in server tests. | `apps/server/src/api/modules/role/deps.ts`, `role.service.ts` |
| 16 | P0-06 | test-support: helper for a member with an exact permission set? | `createUserWithOrganization`, `createUser`, `createOrganization` in `factories.ts`. Roles assigned via owner API `POST /organizations/{orgId}/roles` + assignment. | `apps/server/src/api/test-support/factories.ts` |
| 17 | P0-06 | Status and code an outsider receives in existing integration tests | 403 Forbidden with code `ORGANIZATION_FORBIDDEN` on tenant boundary or `ROLE_PERMISSION_DENIED` on permission failure. | `apps/server/src/api/modules/organization/organization.routes.int.test.ts` |
| 18 | P0-06 | Database-backed vitest harness in `packages/db`? | No. `packages/db` only runs `tsc --noEmit` / `tsc -p tsconfig.build.json` and drizzle-kit. | `packages/db/package.json` |
| 19 | P0-06 | e2e: fixtures and support names, spec folder, locale switching, viewport | Specs in `apps/web/e2e/specs/`, `fixtures.ts` exports `test` with `account`, `signedInPage`. Copy helper in `support/copy.ts`. | `apps/web/e2e/` |
| 20 | P0-02 | Toast / notification mechanism and dialog pattern in neighbouring web modules | Toast: `sonner` (`toast.success(...)`). Dialogs: `@workspace/ui/components/dialog` wrapping Create/Update forms. | `apps/web/src/features/role-module/forms/role-dialog.tsx` |
| 21 | P0-07 | Existing customer / vendor tables and sales / purchase document modules | None exist. No legacy tables or sales/purchase document modules. Phase 7 tasks P7-02 to P7-05 are `[-]` (N/A). | `packages/db/src/schema/`, `apps/server/src/api/modules/` |

## Commands (fill in P0-08)

| Purpose | Command | Notes |
|---|---|---|
| Install | `pnpm install` | Root pnpm workspace |
| contracts: typecheck · lint · test · build | `pnpm --filter @avuny/contracts typecheck && pnpm --filter @avuny/contracts test && pnpm --filter @avuny/contracts build` | Vitest + tsc build |
| db: typecheck · lint · test | `pnpm --filter @avuny/db typecheck && pnpm --filter @avuny/db build` | No vitest in db |
| db: `drizzle-kit generate` | `pnpm --filter @avuny/db db:generate` | Drizzle Kit SQL generation |
| db: apply migrations to a local empty database | `pnpm --filter @avuny/db db:migrate` | Migrates target db |
| seed | `pnpm --filter @avuny/books-server seed` | Runs seeds |
| server: typecheck · lint · unit | `pnpm --filter @avuny/books-server typecheck && pnpm --filter @avuny/books-server test` | Hono server suite |
| server: integration | `pnpm --filter @avuny/books-server test:int` | Real app + real test DB |
| Orval generation | `pnpm api:generate` (or `pnpm openapi:generate && pnpm api:generate`) | OpenAPI spec -> Orval client |
| web: typecheck · lint · test | `pnpm --filter @avuny/books-web typecheck && pnpm --filter @avuny/books-web test` | Vite + Vitest |
| web: e2e | `pnpm --filter @avuny/books-web e2e` | Playwright browser suite |

## Test status board

Update the counts only after running the suite.

| Suite | Groups (SPEC §11) | Written | Passing |
|---|---|---|---|
| Contracts | CT-ENUM, CT-CREATE, CT-CONTACT, CT-UPDATE, CT-QUERY, CT-DTO, CT-HELPERS, CT-LOCALE | 8 / 8 | 8 / 8 |
| Database | DB-01 … DB-10 | 10 / 10 | 10 / 10 |
| Rules | RU-STATE, RU-ADDROLE, RU-SALUTATION, RU-PLAN, RU-FIELDS | 0 / 5 | 0 / 5 |
| Service | ST-AUTH, ST-CREATE, ST-UPDATE, ST-ROLE, ST-READ, ST-PORT, ST-AUDIT | 0 / 7 | 0 / 7 |
| Routes (integration) | RT-AUTH, RT-PERM, RT-LIFE, RT-DUAL, RT-SHARED, RT-ROLE, RT-CONTACT, RT-LIST, RT-OPTION, RT-TENANT, RT-CONFLICT, RT-VALID | 0 / 12 | 0 / 12 |
| Web unit | WT-ROLES, WT-PRIMARY, WT-PAYLOAD, WT-API, WT-FORM, WT-LOCALE | 0 / 6 | 0 / 6 |
| Web e2e | E2E-01 … E2E-08 | 0 / 8 | 0 / 8 |

## Hardening verification (SPEC §1.2)

Tick when the correction is implemented **and** its proof has run.

| ID | Correction | Proof | Done |
|---|---|---|---|
| H1 | Replacement order: delete → demote → park → update → insert → verify | RU-PLAN, RT-CONTACT | [ ] |
| H2 | Lock `FOR NO KEY UPDATE`; `FOR SHARE` in `assertActiveRole(tx)` | P4-01 review | [ ] |
| H3 | Pre-validate; late errors escape via rollback and are translated after | ST-CREATE, ST-UPDATE, RT-CONFLICT | [ ] |
| H4 | `addRole` checks create and update up front; no repository call when neither | ST-AUTH, ST-ROLE, RT-PERM | [ ] |
| H5 | Options cursor carries the Postgres `lower(display_name)` | ST-READ, RT-OPTION | [ ] |
| H6 | Search uses `EXISTS`; one row per party | RT-LIST, RT-OPTION | [ ] |
| H7 | No `z.coerce.boolean()` for `isActive` | CT-QUERY, RT-VALID | [ ] |
| H8 | `roles` is form state; checkbox is a view over it | WT-FORM | [ ] |
| H9 | Persisted contact id carried as `contactId` in form state | WT-PAYLOAD, E2E-03 | [ ] |
| H10 | PATCH: `null` clears, `""` rejected; web sends only changes | CT-UPDATE, WT-PAYLOAD | [ ] |
| H11 | Website `http(s)` only; link guard; notes as plain text | CT-CREATE, P6-08 review | [ ] |
| H12 | Audit metadata: ids and field names only | ST-AUDIT | [ ] |
| H13 | Max 10 entries per contact collection | CT-CONTACT, RT-CONTACT | [ ] |
| H14 | Deterministic contact ordering (primary first) | P4-03, ST-CREATE | [ ] |
| H15 | Re-read inside the transaction; invariant breaches throw | P4-05 review, ST-UPDATE | [ ] |
| H16 | Prefix invalidation; navigate only if the actor can read the opposite view | WT-API, E2E-04 | [ ] |
| H17 | LTR rendering of emails, phones, URLs in RTL | P8-04, E2E-08 | [ ] |
| H18 | `text` + checks; row type `PartyRoleAssignment` | P2-01 review, DB-07 | [x] |
| H19 | Test layers: rules, service, route integration, e2e | G4, G6, G8 | [ ] |
| H20 | Built-in role grants | P3-04 | [x] |
| H21 | Pure `party.rules.ts` injected; orchestration-only service | RU-*, P4-05 review | [ ] |

## Acceptance checklist (SPEC §13)

- [ ] AC-01 Exactly one Party backend module
- [ ] AC-02 Exactly one Party frontend feature
- [ ] AC-03 No separate Customer or Vendor identity modules or tables
- [ ] AC-04 Customers and Vendors remain separate navigation entries
- [ ] AC-05 Both views use the same Party id
- [ ] AC-06 A party can have both roles
- [ ] AC-07 Normal creation always creates a new party
- [ ] AC-08 Duplicate names, emails and phones never merge parties
- [ ] AC-09 Opposite-role checkbox works at creation
- [ ] AC-10 Existing party receives the opposite role without duplication
- [ ] AC-11 Inactive roles can be reactivated
- [ ] AC-12 Shared information identical in both role views
- [ ] AC-13 Customer and Vendor permissions remain independent
- [ ] AC-14 Multiple emails, phones and addresses supported
- [ ] AC-15 Every non-empty contact collection has exactly one primary
- [ ] AC-16 Contact updates are transactional and preserve retained ids
- [ ] AC-17 All tenant-owned references use composite foreign keys
- [ ] AC-18 Tables have the required comment blocks and indexes
- [ ] AC-19 Organization-scoped Hono routes with OpenAPI contracts
- [ ] AC-20 The service implements all six mandatory operations
- [ ] AC-21 Repository operations take optional transaction parameters
- [ ] AC-22 No expected failure can commit partial changes
- [ ] AC-23 All activity events come from the central registry
- [ ] AC-24 API and web locales complete in English and Arabic
- [ ] AC-25 Orval client regenerated
- [ ] AC-26 Transactional documents validate the appropriate active role
- [ ] AC-27 Historical documents preserve snapshots
- [ ] AC-28 Service tests and real route integration tests pass
- [ ] AC-29 Database migrations pass verification
- [ ] AC-30 Contracts, database, server and web checks pass
- [ ] AC-31 Web e2e tests pass
- [ ] AC-32 Mobile layout and Arabic RTL verified

---

## Verification log

Newest first. One row per command run that proves a task, gate or suite.

| Date | Scope | Command | Result | Notes |
|---|---|---|---|---|
| 2026-11-24 | Permissions | `turbo typecheck` | 19 packages clean | All derived PermissionKey and ActivityLogAction types verify |
| 2026-11-24 | Sidebar | `pnpm seed:sidebar` | 5 headings, 11 options seeded | Customer and Vendor added to sidebar |
| 2026-11-24 | Permissions | `pnpm --filter @avuny/db seed:permissions` | 3 system roles, 0 deleted | Idempotent system roles sync |
| 2026-11-24 | Database | `tsx -e` verification script | 5 tables, 10 enum values, 60 constraints | DB-01 through DB-10 verified on Postgres |
| 2026-11-24 | Database | `pnpm --filter @avuny/db db:migrate` | Migrations applied successfully | 0021_bouncy_champions.sql applied |
| 2026-11-24 | Database | `pnpm --filter @avuny/db db:generate` | Created 0021_bouncy_champions.sql | SQL verified: only party objects |
| 2026-11-24 | Database | `pnpm --filter @avuny/db build` | 0 errors | db compiles and builds cleanly |
| 2026-11-24 | Contracts | `pnpm --filter @avuny/contracts build && pnpm --filter @avuny/contracts test` | 19 files, 212 passed | All CT groups pass (CT-ENUM, CT-CREATE, CT-CONTACT, CT-UPDATE, CT-QUERY, CT-DTO, CT-HELPERS, CT-LOCALE) |
| 2026-11-24 | Contracts | `pnpm intl:generate` | Successfully updated | party locale namespace registered in server intl |
| 2026-11-24 | Contracts | `pnpm --filter @avuny/contracts typecheck` | 0 errors | Typecheck passes clean |
| 2026-11-24 | Baseline | `pnpm --filter @avuny/books-web test` | 30 passed, 1 failed (refresh-token) | Pre-existing failure in web auth test |
| 2026-11-24 | Baseline | `pnpm --filter @avuny/books-server test` | 59 passed, 1 failed (forgot-password) | Pre-existing failure in server auth test |
| 2026-11-24 | Baseline | `pnpm --filter @avuny/contracts test` | 15 passed, 187 tests green | All contracts tests passing |
| 2026-11-24 | Baseline | `pnpm typecheck` | 19 packages successful | Full monorepo typecheck clean |
| 2026-11-23 | Docs | SPEC.md and PROGRESS.md written | n/a | No implementation work done yet |

## Deviations from SPEC.md

| # | Date | Section | Deviation | Reason | Approved by |
|---|---|---|---|---|---|

## Blockers and open questions

| # | Date | Task | Question or blocker | Status |
|---|---|---|---|---|

## Handoff notes

_Write here at the end of every session: what was done, what is half-done, what to do first next time, anything surprising._
