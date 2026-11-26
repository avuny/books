# Implementation plan — Purchase Order & Supplier Shipment

> Source spec: [`SPEC.md`](./SPEC.md) (imported from the owner's Drive "Avuny Books/specs" folder, 2026-11-26). The spec wins over this plan; log any deviation in PROGRESS.md.
> Progress and resume point: [`PROGRESS.md`](./PROGRESS.md). Tests: [`TEST-PLAN.md`](./TEST-PLAN.md).
> Build order across modules: [`../COMMERCE-IMPLEMENTATION-PLAN.md`](../COMMERCE-IMPLEMENTATION-PLAN.md).
> Depends on: existing Party, Item/UOM, Warehouse, Stock Movement modules.

## How an agent executes this plan

1. Read root `AGENTS.md`, `.agents/workflows/new-module.md`, then SPEC sections 1 to 3.
2. Phase 0 first: answer every "Repository checks before implementation" item in the SPEC by reading the code, and record results in the PROGRESS decision log. Do not infer from table names.
3. Then Phases 1 to 4 in order. A phase ends only when its gate is fully ticked with evidence.
4. Every task: contracts first (`packages/contracts`), then db migration (append-only), server, `pnpm codegen` and `pnpm api:generate`, then web. Copy in locales (en, ar). Follow `.agents/rules/*`.
5. Tests follow `docs/TESTING-PLAN.md` section 4. Copy `docs/templates/TEST-PLAN.md` to `TEST-PLAN.md` and fill the AC table from the SPEC acceptance criteria.
6. Commit per task (docs/GIT.md). Push to a feature branch off `dev`. Never merge to main.

## Phase 0 — Discovery and decisions

| ID | Task | Done when | Status |
|---|---|---|---|
| P0-01 | Complete the SPEC "Repository checks before implementation" list | Each item answered in PROGRESS decision log with file references | [ ] |
| P0-02 | Resolve open SaaS spec fixes that this module depends on (transactions driver D1, money representation D2, see `../SAAS-SPEC-FIXES-PLAN.md`) | Decisions recorded; posting use cases can run in one DB transaction | [ ] |
| P0-03 | Copy TEST-PLAN template and map SPEC acceptance criteria | TEST-PLAN.md has one row per criterion | [ ] |
| P0-04 | Add permission resources and default role grants (`.agents/rules/60-rbac.md`) | Registry updated, role tests pass | [ ] |

**Gate G0:** all P0 tasks done, no `open` decision blocking Phase 1.

## Phase 1 — Build (the SPEC "Implementation sequence")

| ID | Task | Done when | Status |
|---|---|---|---|
| P1-01 | Confirm Party module capability/role API and reuse it for supplier selection. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-02 | Add contracts for PO, shipment, and payment terms. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-03 | Refactor generic LineItems and add reusable DatePickerField while preserving Inventory Adjustment behavior. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-04 | Implement Payment Terms seeding, management, and max-count guard. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-05 | Implement PO schema, numbering, draft form, confirmation, and PO details. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-06 | Add `inventory_items.inTransitQty` migration coordinated with receipt module. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-07 | Implement supplier shipment drafts/posting/reversal and projection reconciliation. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |
| P1-08 | Integrate Receipt and AP modules through stable document IDs and source references. | Code merged, unit + route integration tests for this step pass, evidence logged | [ ] |

**Gate G1:** every SPEC acceptance criterion has a passing named test; posting is atomic and idempotent; reversal and concurrency tests pass; tenancy and permission matrix suites include the new routes.

## Phase 2 — Web and copy

| ID | Task | Done when | Status |
|---|---|---|---|
| P2-01 | Screens per SPEC UI section, using `@workspace/ui/blocks/form`, containers and copy via `t()` | List, create, detail, state actions work against the real API | [ ] |
| P2-02 | Sidebar entry and routes (`.agents/skills/web-routes`), permission-aware hiding | Entry visible only with permission; forbidden route shows a denied page | [ ] |
| P2-03 | Arabic copy and RTL check | `sync:i18n:check` passes; RTL screenshot reviewed | [ ] |

**Gate G2:** e2e main journey and permission-denied journey pass in CI.

## Phase 3 — Hardening and acceptance

| ID | Task | Done when | Status |
|---|---|---|---|
| P3-01 | Reconciliation checks (projections vs movements, journals balanced) as tests and as nightly invariant job (`docs/FEATURE-TRACKING.md` section 4) | Tests green, job documented | [ ] |
| P3-02 | Update `docs/features/REGISTRY.md`, PROGRESS.md, and audit findings closed by this module | Rows updated | [ ] |
| P3-03 | Post-deploy smoke covers one write path of this module | Smoke spec added | [ ] |

**Gate G3:** module status `done` in the registry.
