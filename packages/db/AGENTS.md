# AGENTS.md (packages/db)

# AGENTS.md: `@avuny/db`

Drizzle ORM + PostgreSQL schema for a multi-tenant SaaS (**organization = tenant**).
This package is **schema only**: tables, enums, relations, inferred types, seeds.
No business logic, no HTTP, no services (those live in the API and service packages).

These rules are mandatory. If a task conflicts with a rule, stop and ask; do not work around it.
Before writing anything, open the closest existing file and copy its shape:
`src/schema/access-control/role.ts` (tables) and `src/schema/inventory/item.ts` (tenant-scoped tables with composite FKs).

## Order of work

Constants and enums come from `@avuny/contracts` first (see `packages/contracts/AGENTS.md`), then the schema here.
Never invent enum values or length limits in this package.

## Layout

```
src/schema/
  _helpers.ts          the ONLY cross-cutting file: pk, timestamps, money, quantity, check helpers
  index.ts             re-exports every domain folder
  <domain>/            one folder per domain (access-control, organization, inventory, ...)
    <table-group>.ts   related tables together; the enum a table owns lives in the same file
    relations.ts       ALL drizzle `relations()` of the domain
    index.ts           re-exports the domain's files
```

- Never put enums or jsonb types in `_helpers.ts`.
- Every new folder must be re-exported from its parent `index.ts`, or consumers cannot import it.
- Consumers import from `@avuny/db` only, never from deep paths.

## Code style

- TypeScript strict. **No `any`.** Prefer inferred types.
- Relative imports use the `.js` extension: `import { pk } from "../_helpers.js"`.
- Match the surrounding file for formatting (domain files use double quotes, no semicolons, 4-space indent).

## Table conventions

Every table has:

1. A **comment block above it**: what it is, the real-world flow (who creates it, when, what happens next), the integrity rules it enforces, and what is NOT expressible in the schema (service layer or trigger). Tables without `org_id` say how RLS reaches them (see `role_permissions`).
2. `id: pk()` and `...timestamps()` (unless it is a pure join table with a composite PK, like `organization_user_roles`).
3. `orgId: orgRef()` if it is tenant data.
4. An exported type: `export type Thing = typeof things.$inferSelect`.

```ts
/**
 * THINGS: <one line>.
 * Flow: <who/when>.
 * Integrity: <constraints and why>.
 * Not expressible here: <service rules>.
 */
export const things = pgTable(
    "things",
    {
        id: pk(),
        orgId: orgRef(),
        name: text("name").notNull(),
        isActive: boolean("is_active").notNull().default(true),
        ...timestamps(),
    },
    (t) => [
        unique("ux_thing_org_id").on(t.orgId, t.id), // FK target for children
        uniqueIndex("ux_thing_org_name").on(t.orgId, sql`lower(${t.name})`),
        check("ck_thing_name_len", lengthBetween(t.name, THING_NAME_MIN_LENGTH, THING_NAME_MAX_LENGTH)),
    ]
)
export type Thing = typeof things.$inferSelect
```

## Naming

- Tables: plural snake_case (`unit_collections`). Columns: snake_case in SQL, camelCase in TS.
- Constraint names are explicit and prefixed: `ux_` unique, `ix_` index, `ck_` check, `fk_` composite FK.
- Tenant column is `org_id` / `orgId`, always via `orgRef()`.
- Boolean columns read as facts: `is_active`, `is_batch_tracked`, `allow_negative_stock`.

## Multi-tenancy and integrity

- A child of a tenant table points at it with a **composite FK** `(org_id, parent_id) -> (org_id, id)`, so a row can never reference another organization's data. The parent needs `unique("ux_<parent>_org_id").on(t.orgId, t.id)`.
- Prefer a database guarantee over a service check whenever it is one constraint away (composite FK, `CHECK`, partial unique index). Put the rest in the comment block.
- Case-insensitive names: unique index on `lower(col)`. Nullable scope columns (e.g. `parent_id`): use two partial unique indexes (NULLs are distinct).
- Every FK states `onDelete` explicitly. Default to `restrict`; `cascade` only for rows owned by the parent (settings, permissions); `set null` only for audit pointers.
- No soft delete unless the spec asks. Use `is_active` for deactivation or `softDelete()` where specified.

## Data types

- Money: `money()` (bigint minor units) + `currency()`. Never float or `numeric`.
- Stock quantities: `quantity()`; unit conversion factors: `conversionFactor()`. Drizzle returns `numeric` as a **string**: never convert to `number`.
- Timestamps: `timestamptz` helpers only.
- Check constraints cannot use bind parameters. Use `lengthBetween`, `matchesRegex`, `isNormalized`, or `sql.raw` with **constants imported from contracts**, never literals.

## Enums

- Derive `pgEnum` values from the `as const` arrays in `@avuny/contracts` (`pgEnum("unit_type", UNIT_TYPES)`).
- Postgres cannot drop enum values. Only append. Never rename, reorder or remove; deprecate in contracts instead.
- `permission_resource` / `permission_action` come from `PERMISSION_CATALOG`. After changing the catalog, run `drizzle-kit generate`.

## Migrations

- Generate with `drizzle-kit generate`. Never hand-edit generated SQL and never edit a migration that was already committed.
- Triggers, extensions (`pg_trgm`), RLS policies and data backfills go in a custom migration (`drizzle-kit generate --custom`).
- Read the generated SQL before finishing. It must contain only your change. Unrelated diffs mean something is wrong.
- One logical change per migration.

## Seeds

- Definitions live in contracts (`SYSTEM_ROLES`, `SYSTEM_UNITS`). The seed script only syncs them.
- Seeds are idempotent upserts keyed by the identity named in the definition file. Removing a definition never deletes a row.

## Create a new module: checklist

1. Constants and enums added in contracts first (limits, enum arrays, seed definitions).
2. Folder `src/schema/<domain>/` with table file(s), `relations.ts`, `index.ts`.
3. Each table follows the template: comment block, `pk()`, `orgId`, `timestamps()`, named constraints, exported type.
4. Composite FKs for tenant parents, explicit `onDelete`, indexes for every FK column that will be filtered or joined.
5. Re-export from `src/schema/index.ts`.
6. If the module has permissions: add the resource to `PERMISSION_CATALOG` in contracts.
7. `drizzle-kit generate`, read the SQL.
8. Run the verify steps below.

## Modify existing code: rules by change type

| Change | Rule |
| --- | --- |
| Add nullable column | Safe. Update the comment block. |
| Add `NOT NULL` column to a populated table | Needs a default or a backfill: add in two steps (nullable, backfill via custom migration, then `NOT NULL`). |
| Rename column or table | drizzle-kit may emit drop + create (data loss). Answer the rename prompt, then verify the SQL is `RENAME`. |
| Change a column type | Check the generated `USING` cast. |
| Add a CHECK or unique constraint | Confirm existing data satisfies it, or backfill first. |
| Add enum value | Append in contracts, regenerate. |
| Remove enum value or drop column/table | Not without explicit instruction. Ask. |

When you change a table, also update: its comment block, `relations.ts`, the contracts constants it depends on, and any seed that touches it.

## Verify before you finish

Use the scripts in this package's `package.json`:

- Typecheck and lint pass with no new warnings.
- `vitest` passes. Add tests for any pure logic you add here (seed sync, helpers).
- `drizzle-kit generate` produces exactly the intended SQL, and it applies cleanly to an empty local database.
- Nothing outside `packages/db` and the needed `packages/contracts` constants changed.

## Do not

- Do not add queries, services or business rules here.
- Do not duplicate a constant or enum that exists in contracts.
- Do not use `any`, floats for money or quantities, or implicit `onDelete`.
- Do not edit committed migrations or hand-edit generated SQL.
- Do not leave a table without its comment block.