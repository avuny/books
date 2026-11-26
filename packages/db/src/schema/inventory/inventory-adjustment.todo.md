# inventory-adjustment.todo.md (Database)

## Task Overview
Implement database schema, migrations, and relations for the Inventory Adjustment domain tables (`inventory_adjustments`, `inventory_adjustment_lines`, `inventory_adjustment_reasons`) in `@avuny/db`.

## Completed
- [x] Define enums `inventory_adjustment_status` and `inventory_adjustment_direction` — completed: 2026-11-20 14:35
- [x] Define tables with tenant isolation (`org_id`), composite FKs, checks, and unique indexes — completed: 2026-11-20 14:38
- [x] Configure Drizzle relations in `schema/inventory/relations.ts` — completed: 2026-11-20 14:40
- [x] Export schema in `schema/inventory/index.ts` — completed: 2026-11-20 14:40
- [x] Generate SQL migration `0018_short_mephisto.sql` via `drizzle-kit generate` — completed: 2026-11-20 14:42
- [x] Typecheck and build verification — completed: 2026-11-20 14:43

## In Progress
None.

## Pending
None.

## Blocked
None.

## Decisions and Notes
- `inventory_adjustments.org_id` has composite foreign keys referencing organizations.
- Lines table cascade deletes with parent adjustment (`onDelete: "cascade"`).
- Quantities stored as `numeric(18, 4)`.
- Reasons support system seeds (`org_id` is nullable for system presets, non-null for tenant custom reasons).

## Modified Files
- `packages/db/src/schema/inventory/inventory-adjustment.ts` (created)
- `packages/db/src/schema/inventory/relations.ts` (added adjustment & line relations)
- `packages/db/src/schema/inventory/index.ts` (re-exported `./inventory-adjustment.js`)
- `packages/db/drizzle/0018_short_mephisto.sql` (generated migration)
- `packages/db/drizzle/meta/_journal.json` (updated migration journal)

## Verification
- `pnpm --filter @avuny/db typecheck`: Passed.
- `pnpm --filter @avuny/db build`: Passed.

## Next Steps
- Apply migration in DB environment during deployment.
