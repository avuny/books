# inventory-adjustment.todo.md (Web)

## Task Overview
Build the complete web UI feature module and routes for Inventory Adjustment under `apps/web/src/features/inventory-adjustment-module/` and `apps/web/src/routes/organization/$orgId/inventory-adjustments/` following the 2-kind component architecture (pure views + containers), TanStack Table, React Hook Form + Zod, RTL support, and full locale integration.

## Completed
- [x] Register `inventory-adjustment` i18n resources in `apps/web/src/i18n/resources.ts` and `apps/web/src/i18n/i18n.ts` — completed: 2026-11-20 15:10

## In Progress
- [ ] Create `types.ts` and `inventory-adjustment-api.ts` (+ tests) — started: 2026-11-20 15:11
- [ ] Create `components/` (status badge, direction badge)
- [ ] Create `lib/` (labels hook, calculation helpers + tests)
- [ ] Create `forms/` (create & update form view + container, line repeater, snapshot fetching, dialog)
- [ ] Create `list/` (columns, mobile card, list container with status tabs & search)
- [ ] Create `details/` (details view + container)
- [ ] Create barrels (`index.ts`)
- [ ] Create routes under `src/routes/organization/$orgId/inventory-adjustments/`

## Pending
- [ ] Verify typecheck, lint, and tests across `@avuny/books-web`

## Blocked
None.

## Decisions and Notes
- Views are pure presentational components taking pre-translated `copy` and callbacks.
- Containers wire API queries/mutations, permissions, `useTranslation`, and dialog states.
- The only file importing `@/api` is `inventory-adjustment-api.ts`.
- Line input allows selection of warehouse location, item (AsyncComboBox), unit, optional batch, and counted quantity, automatically fetching system quantity snapshot converted to selected unit.
- Document level actions: Save as Draft, Confirm & Post, Cancel, Delete (drafts only).

## Modified Files
- `apps/web/src/i18n/resources.ts` (added inventory-adjustment translations)
- `apps/web/src/i18n/i18n.ts` (added inventory-adjustment namespace)
- `apps/web/src/features/inventory-adjustment-module/inventory-adjustment.todo.md` (created)

## Verification
Pending.

## Next Steps
- Implement `types.ts`, `inventory-adjustment-api.ts`, and `inventory-adjustment-api.test.ts`.
