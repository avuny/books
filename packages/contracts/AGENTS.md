# AGENTS.md: `@avuny/contracts`

The shared contract layer between the database, the API and the web/mobile apps:
constants, enums, error codes, Zod schemas and DTO types, pure rules, and i18n locales.
One folder per module under `src/` (`role`, `user`, `organization`, `unit`, `item`, ...).

These rules are mandatory. If a task conflicts with a rule, stop and ask; do not work around it.
Before writing anything, open the closest existing module and copy its shape. `src/role/` is the reference.

## Order of work

For a feature that touches storage, work here **first**, then `@avuny/db`, then the API, then the apps.
`@avuny/db` derives its enums and check-constraint bounds from this package, so a mistake here becomes a migration.

## Ground rules

- **Pure and dependency-light.** No I/O, no database, no HTTP, no React. Never import from `@avuny/db`, the API or the apps (the dependency points the other way).
- Zod comes from `@avuny/zod`, never from `zod`: `import { z } from "@avuny/zod"`.
- TypeScript strict. **No `any`.**
- Relative imports use the `.js` extension: `export * from "./constants.js"`.
- Tests use vitest, colocated as `*.test.ts` next to the code.
- Consumers read this package from `dist/`. Rebuild it (turbo does this through the dependency graph) before typechecking `db`, `api` or the apps.

## Module layout

```
src/<module>/
  constants.ts   limits, enum arrays, defaults, audit event names
  errors.ts      <Module>ErrorCode
  schemas.ts     Zod schemas + inferred types (input, DTO, list query/response)
  locales/
    en.json
    ar.json
    index.ts     <module>TranslationsEn / <module>TranslationsAr
  index.ts       re-exports every file above
```

A module may start with only `constants.ts` and `index.ts` (as `unit`, `item`, `item-category` do) and gain the other files when the API or web needs them.
Module-specific pure logic gets its own file (`role/rbac.ts`, `role/permission-catalog.ts`, `role/system-roles.ts`, `unit/system-units.ts`).

## File rules

**constants.ts**
- `UPPER_SNAKE_CASE`, **prefixed with the module** (`ITEM_NAME_MAX_LENGTH`). The root `index.ts` does `export *` from every module, so unprefixed names collide.
- Enums are `as const` arrays plus a derived type:
  `export const UNIT_TYPES = ["count", "weight"] as const` and `export type UnitType = (typeof UNIT_TYPES)[number]`.
- A limit that backs a database check carries the constraint name in a comment: `export const ROLE_NAME_MAX_LENGTH = 60 // ck_role_name_len`. `@avuny/db` reads these constants to build the check, so the API and the database cannot disagree.
- Audit events: `<MODULE>_AUDIT_EVENTS = { CREATED: "role.created" } as const`.

**errors.ts**
- Object plus type with the same name, values equal to keys: `RoleErrorCode.ROLE_NOT_FOUND = "ROLE_NOT_FOUND"`.
- Codes are prefixed with the module and are public API: **never rename or reuse one.**

**schemas.ts** (group with `/* ---------- section ---------- */` headers)
- Bounds come from `constants.ts`, never literals.
- Strings: `.trim()` before `.min()/.max()`. IDs: `z.string().uuid()`. Timestamps in DTOs: `z.string().datetime()`.
- Names: `CreateXSchema` / `CreateXInput`, `UpdateXSchema` / `UpdateXInput`, `XDtoSchema` / `XDto`, `XListItemDtoSchema`, `XOffsetListQuerySchema`, `XOffsetListResponseSchema`. Every schema exports its `z.infer` type.
- Update schemas make fields optional and `.refine` that at least one is present. Say in a comment when an array **replaces** the stored set.
- List queries: `z.coerce.number()` for `page` and `pageSize`, defaults and max from constants, optional `search`.
- DTOs never include secrets or internal columns.

**locales/** (namespace = module name; the web reads it with `useTranslation("<module>")`)
- `en.json` and `ar.json` must have **identical key sets**. Arabic is RTL, so no concatenated fragments: each string is complete.
- Fixed sections, in this order: `errors` (keys = error codes), `labels` (resources, actions, effects, system names), `msgs` (success codes, e.g. `ROLE_CREATED`), then UI copy: `list`, `create`, `update`, `fields`, `actions`, `type`, `table`, `empty`, `delete`, `details`, `pagination`.
- ICU placeholders (`{name}`, `{count, plural, ...}`) must match in both files.
- UI copy is complete here because pure UI components receive all text through props.
- New namespace: find where `roleTranslationsEn` is registered (grep) and register the new one in the same places, in the API and in the web app.

## Package wiring (every new module)

1. `package.json` `exports`: add the entry, copied from `./role`:
   ```json
   "./unit": {
     "import": "./dist/unit/index.js",
     "default": "./dist/unit/index.js",
     "types": "./dist/unit/index.d.ts"
   }
   ```
2. `src/index.ts`: add `export * from "./<module>/index.js"` in alphabetical order.
3. Consumers import from the subpath (`@avuny/contracts/unit`), as `@avuny/db` does.

## Permissions

- Every grantable resource is an entry in `PERMISSION_CATALOG` (`role/permission-catalog.ts`). It is the single source for the "create role" screen, server validation and the database enums `permission_resource` / `permission_action`.
- Adding a resource: add the catalog entry, add `labels.resources.<resource>` and any new `labels.actions.<action>` to **both** `role/locales/en.json` and `ar.json`, then regenerate migrations in `@avuny/db`.
- **Never delete or rename** a catalog entry (Postgres cannot drop enum values). Deprecate it.
- Resource tokens are snake_case (`organization_user`); route keys use hyphens (`update:organization-user`).
- New built-in roles go in `SYSTEM_ROLES`; the role name is its identity, so never rename one.

## Create a new module: checklist

1. Folder `src/<module>/` with `constants.ts` and `index.ts` (add `errors.ts`, `schemas.ts`, `locales/` when the API or web needs them).
2. Prefixed constants, `as const` enum arrays with derived types, constraint-name comments on every limit that backs a DB check.
3. Error codes, Zod schemas, DTO types following the naming above.
4. `en.json` and `ar.json` in sync, `locales/index.ts` exporting both, namespace registered.
5. `package.json` export and root `index.ts` line.
6. Permission catalog and role locale labels, if the module has permissions.
7. Tests for any pure logic and for schema defaults, limits and refinements.
8. Verify (below).

## Modify existing code: rules by change type

| Change | Rule |
| --- | --- |
| Add enum value | Append only. Tell the user a migration is needed in `@avuny/db`. |
| Rename or remove an enum value, error code, or exported symbol | Breaking. Do not, unless explicitly told. If told, grep every consumer (`db`, `api`, apps) and update them in the same change. |
| Change a limit that has a `ck_` comment | The database check changes too: a migration in `@avuny/db` is required. Say so. |
| Make an input field required, or tighten validation | Breaking for clients. Check consumers first. |
| Add an optional field to a DTO | Safe. Update the schema, the type and the consumers that map it. |
| Add or change user-facing text | Edit `en.json` **and** `ar.json` together. |

## Verify before you finish

Use the scripts in this package's `package.json`:

- Typecheck and lint pass with no new warnings.
- `vitest` passes, with tests added or updated for what you changed.
- Build succeeds and the new subpath resolves (`@avuny/contracts/<module>`).
- `en.json` and `ar.json` have the same keys, and every error code has an `errors.<CODE>` entry in both.
- No dependency on `db`, the API or the apps was introduced.

## Do not

- Do not import `zod` directly, use `any`, or leave literals where a constant exists.
- Do not rename or reuse error codes, enum values or catalog entries.
- Do not update one locale file without the other.
- Do not add runtime logic that needs I/O. It belongs in the API.
