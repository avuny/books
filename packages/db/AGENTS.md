# AGENTS.md (packages/db)

Database schema (Drizzle ORM), migrations, and database client.

## Rules

- Only `@avuny/api` imports `@avuny/db`. No client apps or other packages may import it.
- Schema changes: generate migrations with `drizzle-kit`. Never hand-edit an applied migration.
- Tenant isolation: every tenant-owned table and query must include organization/tenant scoping.


## Responsibilities
- Own database schema, migrations, database client configuration, and reusable seed logic.
- Keep seed files under `src/seed/`.
- Define database seed scripts in this package's `package.json`.

## Conventions
- Reuse the existing Drizzle ORM setup and database client.
- Follow existing schema, repository, transaction, and naming conventions.
- Respect foreign keys, unique constraints, and tenant isolation.
- Keep reference data separate from development fixtures when appropriate.
- Make seed operations idempotent where appropriate.

## Verification
- Inspect available package scripts before running commands.
- Run relevant seed commands, type checks, and tests against a development or test database.
- Never assume a script exists; inspect `package.json` first.
