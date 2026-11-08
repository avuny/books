# AGENT.md — Server Module Guide (source of truth)

**Scope:** everything under `apps/server/src/api/modules/**`
**Audience:** AI coding agents (and humans) who create, extend, or refactor server modules.

---

## 0. How to use this file

1. **This file is the source of truth.** Every pattern you need is written out below with a short example. You do not need to open another module to learn the structure. (The `role` module is the reference implementation these patterns were extracted from.)
2. **Do not invent helpers.** Only use symbols listed in [§3 Building blocks](#3-building-blocks-import-cheat-sheet). If you need something that is not listed, `grep` for it first; if it does not exist, ask or create it in the right layer.
3. **Work order for any task:** read the request → find the matching recipe ([§5 New module](#5-recipe-a--create-a-new-module), [§6 Refactor](#6-recipe-b--refactor-an-existing-module), [§7 Add endpoint](#7-recipe-c--add-an-endpoint-to-an-existing-module), [§8 Permissions](#8-recipe-d--add-or-change-permissions)) → follow it top to bottom → run the [Definition of Done](#11-definition-of-done).
4. **When code and this file disagree:** new code follows this file. Do not "fix" unrelated modules in the same change. If the difference is a mistake in this file, update this file in the same PR.
5. **Keep `SPEC.md` of each module current** whenever observable behavior changes (new route, error code, rule).

---

## 1. Stack and code style

| Topic | Rule |
|---|---|
| Runtime / framework | Node, TypeScript (ESM), Hono + `@hono/zod-openapi` |
| DB | Postgres via Drizzle ORM (`drizzle-orm`), tables and types from `@avuny/db` |
| Validation | Zod via `@avuny/zod` (`import { z } from "@avuny/zod"`) |
| Tests | Vitest |
| **Relative imports** | **Always end with `.js`** (`"./role.service.js"`), even though files are `.ts` |
| Type-only imports | `import type { X } from "..."` (or inline `type X`) |
| Formatting | 2 spaces, double quotes, **no semicolons**, trailing commas in multiline literals, ~100 cols |
| `any` | Forbidden in source. Only allowed in `deps.ts` Proxy getters and in test mocks |
| Dates over the wire | ISO strings (`date.toISOString()`), produced only in mappers |
| IDs | UUID strings, validated in routes with `z.string().uuid()` |

Naming:

| Thing | Convention | Example |
|---|---|---|
| Module folder | singular, kebab-case | `role`, `activity-log`, `warehouse` |
| Module files | `<module>.<kind>.ts` | `warehouse.service.ts` |
| Route files | `<verb>-<thing>.route.ts` | `create-warehouse.route.ts` |
| Factories | `create<Module><Kind>` | `createWarehouseService`, `createWarehouseRepository` |
| Error codes | `<MODULE>_<REASON>` SCREAMING_SNAKE | `WAREHOUSE_NAME_TAKEN` |
| Audit actions | `ActivityLogAction.<MODULE>_<VERB>` → string `"<module>.<verb>"` | `WAREHOUSE_CREATED` → `"warehouse.created"` |
| Unique indexes | `ux_<entity>_<columns>` | `ux_warehouse_org_name` |
| Permission keys | `action:resource`, underscores in resource become hyphens | `"update:organization-user"` |

---

## 2. Architecture

```
HTTP
 └─▶ hono-routes/*.route.ts     auth + permission middleware, request validation, OpenAPI docs,
      │                         calls exactly ONE service method, maps Result → HTTP via handleResult
      ▼
     <module>.service.ts        business rules, transactions, Result<T, Code>, audit log, cache invalidation
      │
      ▼
     <module>.repository.ts     Drizzle queries only (no decisions, no HTTP)
      │
      ▼
     Postgres

@avuny/contracts   shared by server + web: Zod schemas, DTO types, error codes,
                   permission catalog, system roles, audit action names
```

### Layer contract

| Layer | Owns | Must NEVER |
|---|---|---|
| **Contracts** (`@avuny/contracts`) | Zod schemas, inferred DTO/input types, `XErrorCode`, `ActivityLogAction` entries, permission catalog | import `@avuny/db`, Hono, or any server code |
| **Route** (`hono-routes/`) | path, method, OpenAPI metadata, middleware list, param/body/query validation, calling one service method, `handleResult` | query the DB, call the repository, contain business rules |
| **Service** | business rules, tenant checks, transactions, locking, `ok()/fail()`, audit logging, cache invalidation | import Hono, build HTTP responses, `throw` for expected failures |
| **Repository** | Drizzle queries, unique/FK violation → typed result | decide business outcomes, import the service, know HTTP |
| **Mapper** | pure row → DTO conversion | do I/O |
| **deps.ts** | wiring (lazy singletons) | contain logic |

### Dependency rules

* Direction is strictly `route → service → repository → db`. Never upward, never skipping a layer.
* **Cross-module imports go through the other module's `index.ts` barrel only** (e.g. `../activity-log/index.js`). Never import another module's `*.service.ts` / `*.repository.ts` directly.
* A module needs a collaborator (audit log, plan features, cache)? Declare a **port** (small interface) in `<module>.types.ts`, accept it in the service deps as optional, default to a `Dummy*` from `testing.ts`, and wire the real one in `deps.ts`.
* Every query is **scoped by `orgId`** (multi-tenant). Never load a tenant row by `id` alone.

---

## 3. Building blocks (import cheat sheet)

| Need | Import |
|---|---|
| Route definition | `import { createRoute } from "@hono/zod-openapi"` |
| Router, result→HTTP, locale | `import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"` |
| Result helpers | `import { ok, fail, type Result } from "@avuny/utils"` — `ok({ data, msg })`, `fail({ error, msg })` |
| Error meta type | `import type { ErrorMeta } from "@avuny/utils"` |
| Standard error responses | `import { globalErrorResponses } from "@avuny/utils"` (spread **last** in `responses`) |
| Cursor pagination | `import { decodeCursor, toCursorPage } from "@avuny/utils"` |
| Zod | `import { z } from "@avuny/zod"` |
| Contracts | `import { ... } from "@avuny/contracts"` |
| DB handle & types | `import { type DB, type Tx, <tables>, type <Row> } from "@avuny/db"` |
| The shared db instance | `import { db } from "../../db.js"` (from the module root `deps.ts`) |
| PG violation helpers | `import { isUniqueViolation, isForeignKeyViolation } from "../shared/pg-errors.js"` |
| Auth middleware | `import { requireAuth } from "../../auth/index.js"` (from `hono-routes/index.ts`) |
| Permission middleware | `import { requirePermission } from "../../role/index.js"` (other modules) |
| Audit log service | `import { activityLogService } from "../activity-log/index.js"` (in `deps.ts`) |
| Translator for errors | `import { trans } from "../../../intl/i18next.js"` (from `hono-routes/`) |

Permission-related contract helpers: `PERMISSION_CATALOG`, `SYSTEM_ROLES`, `parsePermissionKey`, `evaluate`, `canAccess`, `grantsAll`, `hasPermission`, `findInvalidStatement`, `PERMISSION_WILDCARD`.

Response envelope: success `{ success: true, data, msg? }`; failure uses the domain-error envelope produced by `handleResult`.

---

## 4. Module anatomy

```
apps/server/src/api/modules/<module>/
├── SPEC.md                      # purpose, domain model, rules, error codes, file map (keep current)
├── index.ts                     # public barrel — the ONLY thing other modules import
├── deps.ts                      # lazy singleton wiring + Proxy exports
├── <module>.types.ts            # service/repository types (ReturnType<...>), ports, deps bags
├── <module>.errors.ts           # code → { statusCode, responseMessage }
├── <module>.error-map.ts        # full error map for the module
├── <module>.mapper.ts           # row → DTO (pure)
├── <module>.repository.ts       # Drizzle queries
├── <module>.service.ts          # business logic (closure factory)
├── <module>.service.spec.ts     # service unit tests (mock repository)
├── testing.ts                   # Dummy* test doubles for ports
├── hono-routes/
│   ├── _shared.ts               # jsonOk, jsonError, honoPath
│   ├── module-routes.types.ts   # RouteDeps
│   ├── <verb>-<thing>.route.ts  # ONE endpoint per file
│   └── index.ts                 # aggregator + singleton router
└── __tests__/
    └── <module>.routes.test.ts  # route tests (mock service)
```

Optional files, only when needed: `<module>.middleware.ts`, `<module>.permissions.ts`, `<module>.seed.ts`, extra `*.spec.ts` per unit.

---

## 5. Recipe A — Create a new module

Worked example: a **`warehouse`** module with `POST /organizations/{orgId}/warehouses` and `GET /organizations/{orgId}/warehouses/{warehouseId}`. Replace names for your module; the shape never changes.

### Step 0 — Decide and document

Write `SPEC.md` first (template in [§5.13](#513-specmd-template)). List endpoints, rules, error codes, permission keys.

### Step 1 — Database (`@avuny/db`)

Add the table and a migration, mirroring an existing org-scoped table: uuid primary key, `orgId` FK, `createdAt`/`updatedAt`, and every uniqueness rule as a **named unique index** (`ux_warehouse_org_name` on `(orgId, name)`). Export the table and its row type (`Warehouse`). The service relies on the named index to map races to a domain error.

### Step 2 — Contracts (`@avuny/contracts`)

Create the module's contract file next to the existing ones (`grep -rn "RoleErrorCode" <contracts package>` to find the folder; mirror its layout and export it from the package index).

```ts
import { z } from "@avuny/zod"

// Error codes: value AND type share one name.
export const WarehouseErrorCode = {
  WAREHOUSE_NOT_FOUND: "WAREHOUSE_NOT_FOUND",
  WAREHOUSE_NAME_TAKEN: "WAREHOUSE_NAME_TAKEN",
} as const
export type WarehouseErrorCode = (typeof WarehouseErrorCode)[keyof typeof WarehouseErrorCode]

export const CreateWarehouseSchema = z.object({
  name: z.string().trim().min(1).max(80),
})
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>

export const WarehouseDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(), // ISO
  updatedAt: z.string(), // ISO
})
export type WarehouseDto = z.infer<typeof WarehouseDtoSchema>
```

Also add the audit actions to `ActivityLogAction` (`WAREHOUSE_CREATED = "warehouse.created"`, …).

> There is **no** `WAREHOUSE_PERMISSION_DENIED`. `requirePermission` is shared and always answers with `RoleErrorCode.ROLE_PERMISSION_DENIED` (403). Document that code in each route's 403 response.

### Step 3 — Errors

`warehouse.errors.ts` — one entry per code, `satisfies` guarantees none is forgotten:

```ts
import { WarehouseErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { WarehouseErrorCode }

export const warehouseErrorsHttpMap = {
  WAREHOUSE_NOT_FOUND: { statusCode: 404, responseMessage: "Warehouse not found" },
  WAREHOUSE_NAME_TAKEN: {
    statusCode: 409,
    responseMessage: "A warehouse with this name already exists",
  },
} as const satisfies Record<WarehouseErrorCode, ErrorMeta>
```

`warehouse.error-map.ts`:

```ts
import { WarehouseErrorCode as Code } from "@avuny/contracts"
import { warehouseErrorsHttpMap as errors } from "./warehouse.errors.js"

export const warehouseErrorMap = {
  WAREHOUSE_NOT_FOUND: errors.WAREHOUSE_NOT_FOUND,
  WAREHOUSE_NAME_TAKEN: errors.WAREHOUSE_NAME_TAKEN,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>
```

### Step 4 — Repository

Rules: factory taking `{ db }`; every method takes an optional trailing `tx`; **always filter by `orgId`**; writes return a discriminated result instead of throwing for expected violations; no business decisions.

```ts
import { and, eq, sql } from "drizzle-orm"
import { warehouses, type DB, type Tx, type Warehouse } from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"

const NAME_INDEXES = ["ux_warehouse_org_name"] as const

type NewWarehouse = typeof warehouses.$inferInsert
export type WarehouseWriteResult =
  | { ok: true; row: Warehouse }
  | { ok: false; reason: "name_taken" | "not_found" }

export function createWarehouseRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db // same code works inside and outside a transaction

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes check-then-write sequences of one organization. */
    async lockOrg(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`warehouses:${orgId}`}, 0))`
      )
    },

    async findById(orgId: string, id: string, tx?: Tx): Promise<Warehouse | null> {
      const [row] = await exec(tx)
        .select()
        .from(warehouses)
        .where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id)))
        .limit(1)
      return row ?? null
    },

    async insert(values: NewWarehouse, tx?: Tx): Promise<WarehouseWriteResult> {
      try {
        const [row] = await exec(tx).insert(warehouses).values(values).returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, NAME_INDEXES)) return { ok: false, reason: "name_taken" }
        throw err // unexpected errors bubble up
      }
    },
  }
}
```

LIKE searches must escape user input: `const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)` then `ilike(col, `%${escapeLike(q)}%`)`.

### Step 5 — Mapper

```ts
import type { WarehouseDto } from "@avuny/contracts"
import type { Warehouse } from "@avuny/db"

export function toWarehouseDto(row: Warehouse): WarehouseDto {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
```

Never return raw rows from the service: mappers hide internal columns and format dates.

### Step 6 — Types and test doubles

`warehouse.types.ts` — derive types from the factories, declare ports:

```ts
import type { createWarehouseRepository } from "./warehouse.repository.js"
import type { createWarehouseService } from "./warehouse.service.js"
import type { ActivityLog, ActivityLogEntry } from "../activity-log/activity-log.port.js"

export type WarehouseRepository = ReturnType<typeof createWarehouseRepository>
export type WarehouseService = ReturnType<typeof createWarehouseService>
export type { ActivityLog, ActivityLogEntry }

export interface WarehouseServiceDeps {
  repository: WarehouseRepository
  activityLog?: ActivityLog // optional port; defaults to a no-op
}
```

`testing.ts`:

```ts
import type { ActivityLog } from "./warehouse.types.js"

export class DummyActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}
```

### Step 7 — Service

Rules: closure factory; returns `Result<T, Code>`; expected failures are `fail(...)`, never `throw`; authorization is **not** here (it is the route's `requirePermission`) but tenant scoping and business rules are; side effects (audit, cache) happen **after** the transaction commits.

```ts
import {
  ActivityLogAction,
  type CreateWarehouseInput,
  type WarehouseDto,
} from "@avuny/contracts"
import { fail, ok, type Result } from "@avuny/utils"
import { WarehouseErrorCode, type WarehouseErrorCode as Code } from "./warehouse.errors.js"
import { toWarehouseDto } from "./warehouse.mapper.js"
import { DummyActivityLog } from "./testing.js"
import type { WarehouseServiceDeps } from "./warehouse.types.js"

const Err = WarehouseErrorCode
const MSG = {
  notFound: "Warehouse not found",
  nameTaken: "A warehouse with this name already exists",
} as const

export function createWarehouseService(deps: WarehouseServiceDeps) {
  const repo = deps.repository
  const activityLog = deps.activityLog ?? new DummyActivityLog()

  return {
    async getById(orgId: string, warehouseId: string): Promise<Result<WarehouseDto, Code>> {
      const row = await repo.findById(orgId, warehouseId)
      if (!row) return fail({ error: Err.WAREHOUSE_NOT_FOUND, msg: MSG.notFound })
      return ok({ data: toWarehouseDto(row), msg: "Warehouse retrieved successfully" })
    },

    async create(
      actorId: string,
      orgId: string,
      input: CreateWarehouseInput
    ): Promise<Result<WarehouseDto, Code>> {
      const res = await repo.insert({ orgId, name: input.name })
      if (!res.ok) return fail({ error: Err.WAREHOUSE_NAME_TAKEN, msg: MSG.nameTaken })

      await activityLog.log({
        action: ActivityLogAction.WAREHOUSE_CREATED,
        actorId,
        orgId,
        resourceId: res.row.id,
        metadata: { name: res.row.name },
      })
      return ok({ data: toWarehouseDto(res.row), msg: "Warehouse created" })
    },
  }
}
```

#### Multi-step writes: transaction + failure sentinel

When one operation reads, checks, then writes, run it in a transaction, lock the org, and return a *failure sentinel* from inside (throwing would roll back but lose the typed error). Copy these four helpers into the top of each service file:

```ts
type Failure = { failed: true; error: Code; msg: string }
const failure = (error: Code, msg: string): Failure => ({ failed: true, error, msg })
const isFailure = (v: unknown): v is Failure =>
  typeof v === "object" && v !== null && (v as Failure).failed === true
const toFail = (f: Failure) => fail({ error: f.error, msg: f.msg })
```

```ts
async rename(actorId: string, orgId: string, id: string, name: string) {
  const outcome = await repo.transaction(async (tx) => {
    await repo.lockOrg(orgId, tx)                       // serialize per organization
    const row = await repo.findById(orgId, id, tx)
    if (!row) return failure(Err.WAREHOUSE_NOT_FOUND, MSG.notFound)
    const res = await repo.update(id, { name }, tx)     // unique index is the race backstop
    if (!res.ok) return failure(Err.WAREHOUSE_NAME_TAKEN, MSG.nameTaken)
    return res.row
  })
  if (isFailure(outcome)) return toFail(outcome)

  // side effects AFTER commit
  await activityLog.log({ action: ActivityLogAction.WAREHOUSE_UPDATED, actorId, orgId, resourceId: id })
  return ok({ data: toWarehouseDto(outcome), msg: "Warehouse updated" })
}
```

Keep `deleteRole`-style checks in order: **not found → forbidden-state (e.g. system/read-only) → in use → delete**, and map FK violations from the repository to the "in use" error.

### Step 8 — Routes

#### `hono-routes/_shared.ts` (copy verbatim into every module)

```ts
import { createDomainErrorResponseSchema, createResponseSchema } from "@avuny/utils"
import type { z } from "@avuny/zod"

export const jsonOk = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema: createResponseSchema(schema) } },
})

export const jsonError = <const C extends readonly [string, ...string[]]>(
  description: string,
  codes: C
) => ({
  description,
  content: {
    "application/json": { schema: createDomainErrorResponseSchema([...codes] as never) },
  },
})

/** "/organizations/{orgId}/x" -> "/organizations/:orgId/x" */
export const honoPath = (openApiPath: string) =>
  openApiPath.replace(/\{([^}]+)\}/g, ":$1")
```

#### `hono-routes/module-routes.types.ts`

```ts
import type { MiddlewareHandler } from "hono"
import type { WarehouseService } from "../warehouse.types.js"
import type { RequirePermissionOptions } from "../../role/index.js"

export interface RouteDeps {
  service: WarehouseService
  requireAuth: MiddlewareHandler
  requirePermission?: (key: string, options?: RequirePermissionOptions) => MiddlewareHandler
}
```

> If `role/index.ts` does not yet export `RequirePermissionOptions`, add `export type { RequirePermissionOptions } from "./role.middleware.js"` there (one line).

`deps` are injected so tests can pass fakes; production wiring happens in `hono-routes/index.ts`.

#### `hono-routes/create-warehouse.route.ts` (the canonical route)

```ts
import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CreateWarehouseSchema,
  RoleErrorCode,
  WarehouseDtoSchema,
  WarehouseErrorCode as Code,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { warehouseErrorsHttpMap as errors } from "../warehouse.errors.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

// Only the codes THIS route can produce; cast so handleResult accepts the full Code union.
const rawErrorMap = { WAREHOUSE_NAME_TAKEN: errors.WAREHOUSE_NAME_TAKEN } as const
const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createWarehouseRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/warehouses",
    operationId: "createWarehouse",
    tags: ["warehouse"],
    summary: "Create a warehouse",
    middleware: [requireAuth, requirePermission("create:warehouse")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateWarehouseSchema } } },
    },
    responses: {
      201: jsonOk("Warehouse created", WarehouseDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Name taken", [Code.WAREHOUSE_NAME_TAKEN]),
      ...globalErrorResponses, // always last
    },
  })

  router.use(honoPath(route.path), requireAuth) // keep: project convention in every route

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.create(user.id, orgId, body)
    return handleResult({
      c,
      result,
      successStatus: 201, // must equal the success key in `responses`
      errorMap,
      errorTrans,
      moduleName: "warehouse",
    })
  })

  return router
}

export default createWarehouseRoute
```

Route checklist:

* `middleware: [requireAuth, requirePermission("<action>:<resource>")] as const` — auth first, permission second.
* Every status the route can return appears in `responses`; each domain code listed under the status its `errorsHttpMap` entry declares.
* Handler body: read validated input → one service call → `handleResult`. Nothing else.
* `moduleName` equals the module name.
* Pass `user.id` as `actorId` for any write (audit + escalation checks).

`get-warehouse.route.ts` is identical in shape: `method: "get"`, `path: "/organizations/{orgId}/warehouses/{warehouseId}"`, `requirePermission("read:warehouse")`, params `{ orgId, warehouseId }`, `200`/`404` responses, calls `service.getById(orgId, warehouseId)`, `rawErrorMap = { WAREHOUSE_NOT_FOUND: ... }`.

**Infallible endpoints** (service method cannot produce a domain error, e.g. a list or static data) skip `handleResult`:

```ts
router.openapi(route, async (c) => {
  const { orgId } = c.req.valid("param")
  const query = c.req.valid("query")
  const result = await service.list(orgId, query)
  if (!result.success) throw new Error("list cannot fail") // invariant, not a domain error
  return c.json({ success: true, data: result.data }, 200)
})
```

**Route order:** in `hono-routes/index.ts`, register static paths before parametric ones that could shadow them (e.g. `/permissions/catalog` before `/permissions/{id}`).

#### `hono-routes/index.ts`

```ts
import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { warehouseService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createWarehouseRoute } from "./create-warehouse.route.js"
import { getWarehouseRoute } from "./get-warehouse.route.js"

export const createWarehouseRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()
  router.route("/", createWarehouseRoute(deps))
  router.route("/", getWarehouseRoute(deps))
  return router
}

export const warehouseRoutes = createWarehouseRoutes({
  service: warehouseService,
  requireAuth,
})

export default warehouseRoutes
```

### Step 9 — Wiring (`deps.ts`) and barrel (`index.ts`)

`deps.ts` builds dependencies **lazily** and exports Proxies, so importing the module never touches the database (tests stay fast; import order stops mattering):

```ts
import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createWarehouseRepository } from "./warehouse.repository.js"
import { createWarehouseService } from "./warehouse.service.js"
import type { WarehouseRepository, WarehouseService } from "./warehouse.types.js"

let _repo: WarehouseRepository | undefined
let _service: WarehouseService | undefined

export function getWarehouseRepository(): WarehouseRepository {
  return (_repo ??= createWarehouseRepository({ db }))
}

export function getWarehouseService(): WarehouseService {
  return (_service ??= createWarehouseService({
    repository: getWarehouseRepository(),
    activityLog: activityLogService,
  }))
}

export const warehouseService = new Proxy({} as WarehouseService, {
  get(_target, prop) {
    return (getWarehouseService() as any)[prop]
  },
})
```

`index.ts` — the public surface; other modules import only from here:

```ts
export { WarehouseErrorCode, warehouseErrorsHttpMap } from "./warehouse.errors.js"
export { warehouseErrorMap } from "./warehouse.error-map.js"
export { createWarehouseService } from "./warehouse.service.js"
export { createWarehouseRepository } from "./warehouse.repository.js"
export { warehouseService, getWarehouseService, getWarehouseRepository } from "./deps.js"
export { warehouseRoutes, createWarehouseRoutes } from "./hono-routes/index.js"
export type { WarehouseService, WarehouseRepository, WarehouseServiceDeps } from "./warehouse.types.js"
```

**Mount the router:** find where `roleRoutes` is mounted (`grep -rn "roleRoutes" apps/server/src`) and register `warehouseRoutes` the same way, next to it.

### Step 10 — Permissions

Add the resource to the catalog, then decide which system roles get it — see [§8](#8-recipe-d--add-or-change-permissions). Without this, `requirePermission("create:warehouse")` denies everyone except owners.

### Step 11 — Tests

**Service test** (`warehouse.service.spec.ts`) — mock the repository, never the DB; a `setup()` factory is rebuilt in `beforeEach`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Warehouse } from "@avuny/db"
import { createWarehouseService } from "./warehouse.service.js"
import type { WarehouseRepository } from "./warehouse.types.js"

vi.mock("../../db.js", () => ({ db: {} })) // transitive imports must not open a connection

const NOW = new Date("2026-01-01T00:00:00Z")
const warehouse = (o: Partial<Warehouse> = {}): Warehouse => ({
  id: "w1", orgId: "org-1", name: "Main", createdAt: NOW, updatedAt: NOW, ...o,
})

function setup() {
  const repository = { findById: vi.fn(), insert: vi.fn() }
  const activityLog = { log: vi.fn(async () => {}) }
  const service = createWarehouseService({
    repository: repository as unknown as WarehouseRepository,
    activityLog,
  })
  return { repository, activityLog, service }
}

describe("warehouseService.create", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => { t = setup() })

  it("creates and audits", async () => {
    t.repository.insert.mockResolvedValue({ ok: true, row: warehouse() })
    const res = await t.service.create("u1", "org-1", { name: "Main" })
    expect(res).toMatchObject({ success: true })
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "warehouse.created", resourceId: "w1" })
    )
  })

  it("maps a duplicate name to WAREHOUSE_NAME_TAKEN", async () => {
    t.repository.insert.mockResolvedValue({ ok: false, reason: "name_taken" })
    const res = await t.service.create("u1", "org-1", { name: "Main" })
    expect(res).toMatchObject({ success: false, error: "WAREHOUSE_NAME_TAKEN" })
    expect(t.activityLog.log).not.toHaveBeenCalled()
  })
})
```

**Route test** (`__tests__/warehouse.routes.test.ts`) — mock the service, bypass auth/permissions, use real UUIDs and the real DTO field names:

```ts
import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok } from "@avuny/utils"
import { createWarehouseRoute } from "../hono-routes/create-warehouse.route.js"

const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
const mockRequireAuth: MiddlewareHandler = async (c, next) => {
  c.set("user", { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" })
  await next()
}
const mockAllowPermission = () => (async (_c: any, next: any) => next()) as MiddlewareHandler

it("POST returns 201 with the created warehouse", async () => {
  const dto = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05", orgId, name: "Main",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const service: any = { create: vi.fn().mockResolvedValue(ok({ data: dto, msg: "Warehouse created" })) }

  const app = createOpenAPIRouter()
  app.route("/", createWarehouseRoute({
    service, requireAuth: mockRequireAuth, requirePermission: mockAllowPermission,
  }))

  const res = await app.request(`/organizations/${orgId}/warehouses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Main" }),
  })
  expect(res.status).toBe(201)
  expect(((await res.json()) as any).data.name).toBe("Main")
})
```

Add one route test per endpoint at least; add error-status tests (`fail(...)` from the mock → expected status) for endpoints with domain errors.

### 5.12 Final file tree of the example

```
warehouse/
├── SPEC.md  index.ts  deps.ts  testing.ts
├── warehouse.types.ts  warehouse.errors.ts  warehouse.error-map.ts
├── warehouse.mapper.ts  warehouse.repository.ts  warehouse.service.ts
├── warehouse.service.spec.ts
├── hono-routes/
│   ├── _shared.ts  module-routes.types.ts  index.ts
│   ├── create-warehouse.route.ts  get-warehouse.route.ts
└── __tests__/warehouse.routes.test.ts
```

### 5.13 SPEC.md template

```md
# Warehouse Module — Specification
> Update this file whenever a requirement changes: new error code, route, policy, or behavior.

## 1. Purpose
One paragraph.

## 2. Domain Model
Table per entity: column | type | notes.

## 3. Business Rules & Policies
Numbered rules, each naming the error code it raises.

## 4. Error Codes
| Code | HTTP | Description |

## 5. File Structure
Annotated tree.
```

---

## 6. Recipe B — Refactor an existing module

**Goal:** move a legacy module (handlers that mix validation, auth, queries and responses) to the structure above **without changing behavior**.

### 6.1 Smell → fix table

| Smell in legacy code | Fix |
|---|---|
| Handler calls `db` directly | Move the query to a repository method with optional trailing `tx` |
| `return c.json({ error: "..." }, 404)` | Service returns `fail({ error: Code.X, msg })`; route uses `handleResult` + `errorMap` |
| `throw new HTTPException(...)` for a business failure | `fail(...)` from the service |
| Inline `if (!body.name)` validation | Zod schema in `@avuny/contracts` + `request:` in `createRoute` |
| Inline role checks (`if (user.role !== "admin")`) | `requirePermission("action:resource")` in `middleware`, resource added to the catalog |
| Business rule in the route | Move into the service |
| Check-then-insert (race) | transaction + `lockOrg` + named unique index mapped to a domain error |
| Raw DB rows in responses | Mapper → DTO (ISO dates, no internal columns) |
| `new XService(db)` at import time | `deps.ts` lazy singleton + Proxy |
| Imports another module's internals | Use its barrel `index.ts`, or define a port in `types.ts` |
| Audit/cache work inside the transaction | Move after commit |
| Query without `orgId` filter | Add it. Treat as a security bug; mention it in the PR |
| One 400-line route file | One endpoint per `*.route.ts` |

### 6.2 Procedure (follow in order, one module per PR)

1. **Inventory.** List every endpoint: method, path, params/body, success status, every error status and message. Write/refresh `SPEC.md` from this list. Paths, methods and status codes **must not change** unless you record it in `SPEC.md` and the PR description.
2. **Characterize.** If there are no tests, write route tests against the *current* behavior first (happy path + each error). They are your safety net.
3. **Contracts.** Move schemas, DTO types and error codes into `@avuny/contracts` ([§5 Step 2](#step-2--contracts-avunycontracts)).
4. **Repository.** Extract every query ([§5 Step 4](#step-4--repository)). Pure data access, `orgId` on every tenant query.
5. **Mapper + errors.** Create `*.mapper.ts`, `*.errors.ts`, `*.error-map.ts`.
6. **Service.** Move all decisions here; return `Result`. Add `*.service.spec.ts`.
7. **Routes.** One file per endpoint; handlers shrink to "validate → service → handleResult".
8. **Wiring.** `deps.ts`, `hono-routes/index.ts`, `index.ts`; point the app mount at the new `*Routes`.
9. **Permissions.** Replace inline checks with `requirePermission`; update catalog/system roles ([§8](#8-recipe-d--add-or-change-permissions)).
10. **Delete** the old files and every dead import. Run the DoD checklist.

### 6.3 Before → after (one endpoint)

**Before** — everything in the handler:

```ts
app.post("/organizations/:orgId/warehouses", async (c) => {
  const user = c.get("user")
  if (user.role !== "admin") return c.json({ error: "forbidden" }, 403)       // auth inline
  const body = await c.req.json()
  if (!body.name) return c.json({ error: "name required" }, 400)              // validation inline
  const orgId = c.req.param("orgId")
  const [dup] = await db.select().from(warehouses)                            // query inline
    .where(and(eq(warehouses.orgId, orgId), eq(warehouses.name, body.name)))
  if (dup) return c.json({ error: "exists" }, 409)                            // rule inline
  const [row] = await db.insert(warehouses).values({ orgId, name: body.name }).returning()
  return c.json(row, 201)                                                     // raw row out
})
```

**After** — each line has a home:

| Legacy line | New home |
|---|---|
| `user.role !== "admin"` | `requirePermission("create:warehouse")` in route `middleware` |
| `!body.name` | `CreateWarehouseSchema` in contracts, used in `request.body` |
| duplicate `select` + `if (dup)` | unique index `ux_warehouse_org_name` → `repo.insert` returns `{ ok: false, reason: "name_taken" }` → service `fail(WAREHOUSE_NAME_TAKEN)` |
| `db.insert(...)` | `repo.insert` |
| `c.json({ error }, 409)` | `warehouseErrorsHttpMap` entry + route `errorMap` + `handleResult` |
| `c.json(row, 201)` | `toWarehouseDto` + `successStatus: 201` |

The resulting route is the one in [§5 Step 8](#step-8--routes); the service is `create` in [§5 Step 7](#step-7--service).

**Behavior parity gotchas:** old error *bodies* will change shape (now the domain-error envelope) — note it in the PR. Old and new status codes must match per the SPEC (e.g. validation failures are produced by the framework, not by hand).

---

## 7. Recipe C — Add an endpoint to an existing module

Checklist, in order:

1. `SPEC.md`: add the rule(s) and error code(s).
2. Contracts: new schema/DTO/error code; add the code to `XErrorCode`.
3. `*.errors.ts` and `*.error-map.ts`: add the entry (the `satisfies` clause fails the build if you forget).
4. Repository: add the query/method (optional `tx`, `orgId` scoped).
5. Service: add the method returning `Result`.
6. Route file `<verb>-<thing>.route.ts` copied from [§5 Step 8](#step-8--routes); add it to `hono-routes/index.ts`.
7. Permission key: reuse an existing one or add per [§8](#8-recipe-d--add-or-change-permissions).
8. Tests: service spec cases + route test.

### Pagination patterns

**Offset (tables):** query schema carries `page`/`pageSize`; repository returns `{ rows, total }`; service returns `{ items, page, pageSize, total }`.

**Cursor (pickers/dropdowns):** order by a **unique** key (e.g. `custom, name, id`), fetch `limit + 1` rows, let `toCursorPage` cut the extra row and build `nextCursor`:

```ts
async listOptions(orgId: string, query: OptionListQuery): Promise<Result<OptionListResponse, Code>> {
  const rows = await repo.listOptions(orgId, {
    search: query.search,
    after: decodeCursor(query.cursor, warehouseOptionCursorSchema), // null on first page
    limit: query.limit + 1,                                         // +1 to detect "has more"
  })
  const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
  return ok({
    data: { items: page.items.map((r) => ({ id: r.id, name: r.name })), nextCursor: page.nextCursor },
    msg: "Warehouse options retrieved successfully",
  })
}
```

Repository side uses a row-value comparison for "continue after":
`` sql`(${roles.name}, ${roles.id}) > (${after.name}::text, ${after.id}::uuid)` `` with `orderBy(asc(name), asc(id))`.

---

## 8. Recipe D — Add or change permissions

### Model

* Statement: `{ effect: "allow" | "deny", resource, action, resourceId }`. `*` is a wildcard for any of the three.
* Evaluation: **explicit deny beats allow; no match = deny.** A statement narrowed to a `resourceId` only applies when that record is checked.
* Actor types: **owner** → always allowed; **portal** and inactive members → never; **managed** → union of statements from their roles.
* Key syntax: `"action:resource"`, lowercase, exactly one colon, no `*`, hyphens stand for underscores in the resource (`"read:organization-user"` → resource `organization_user`). Malformed keys throw at startup (`requirePermission` parses eagerly).
* Roles: system roles (`orgId === null`) are read-only; custom roles are per organization. Role assignment has a **privilege-escalation guard**: non-owners cannot change their own roles and can only grant roles whose allow-statements they already hold.

### Protect a route

```ts
middleware: [requireAuth, requirePermission("update:warehouse")] as const,
```

Options: `requirePermission("update:warehouse", { orgParam: "orgId", resourceParam: "warehouseId" })` — `orgParam` defaults to `"orgId"`; `resourceParam` makes the check record-scoped.

### Register a new resource

1. In `@avuny/contracts`, add an entry to `PERMISSION_CATALOG`:
   ```ts
   { resource: "warehouse", actions: ["create", "read", "update", "delete"], scopable: true }
   ```
   (`scopable: true` allows statements narrowed by `resourceId`; otherwise `resourceId` must be `"*"`.)
2. Decide which `SYSTEM_ROLES` get it and edit their `statements` there, e.g.
   `{ effect: "allow", resource: "warehouse", action: "*", resourceId: "*" }`.
   The existing RBAC spec validates every system role against the catalog; keep it green.
3. System roles reach the DB through `syncSystemRoles(db)` (idempotent, runs on deploy after migrations). Never edit system roles by SQL.
4. Frontend/UI visibility uses `GET /me/organizations/{orgId}/permissions` and `hasPermission(...)` — nothing extra to build server-side.

---

## 9. Error and HTTP conventions

| Status | Use for | Example codes |
|---|---|---|
| 200 | successful read / update / delete (delete returns `{ id }`) | |
| 201 | successful create | |
| 403 | caller not allowed, plan feature missing, privilege escalation | `ROLE_PERMISSION_DENIED`, `ROLE_FEATURE_NOT_AVAILABLE`, `ROLE_ESCALATION_NOT_ALLOWED` |
| 404 | entity missing **or belongs to another org** (never reveal other tenants' data) | `ROLE_NOT_FOUND`, `ROLE_MEMBER_NOT_FOUND` |
| 409 | state conflicts: name taken, in use, read-only, wrong target state | `ROLE_NAME_TAKEN`, `ROLE_IN_USE`, `ROLE_SYSTEM_READONLY`, `ROLE_MEMBER_NOT_ASSIGNABLE` |
| 422 | well-formed request rejected by domain validation | `ROLE_INVALID_PERMISSION` |
| 400 / 401 / 500 | framework validation, authentication, unexpected — provided by `...globalErrorResponses` | |

Rules:

* Every code lives in contracts, has an `errorsHttpMap` entry, and appears in the `jsonError` of every route that can return it.
* Service messages (`msg`) are plain English fallbacks; the route translates via `errorTrans`. When adding codes, add translations wherever existing codes (e.g. `ROLE_NOT_FOUND`) are translated (`grep` under `apps/server/src/api/intl`).
* Expected failures → `fail(...)`. `throw` only for invariants/bugs and truly unexpected errors.

---

## 10. Testing rules

* Framework: Vitest. Unit tests never touch a real DB or network.
* Service tests: `*.service.spec.ts` at the module root; mock the repository (`as unknown as XRepository`); assert both the `Result` and the side effects (`activityLog.log`, cache invalidation, lock order, "not called" for no-ops).
* Route tests: `__tests__/<module>.routes.test.ts`; mock the service; inject `requireAuth`/`requirePermission` fakes through `RouteDeps`; use real UUIDs; request via `app.request(...)`; assert status + body.
* Every service rule in `SPEC.md` has at least one test; every error code has at least one test that produces it.
* Pure logic (evaluators, mappers) gets its own `*.spec.ts` without mocks.
* `vi.mock("../../db.js", () => ({ db: {} }))` at the top of any spec that imports something reaching `db`.
* Mock data must use the **real DTO field names** from the contracts.

---

## 11. Definition of Done

Run through this list before you say a task is finished.

- [ ] Layering respected: no DB in routes, no Hono in services, no HTTP in repositories.
- [ ] Every tenant query filtered by `orgId`.
- [ ] Relative imports end in `.js`; no `any` outside `deps.ts`/test mocks; no semicolons, double quotes.
- [ ] New/changed error codes: contracts + `errorsHttpMap` + `error-map` + route `responses` + (translations if applicable).
- [ ] Routes: `[requireAuth, requirePermission(...)] as const`, `router.use(honoPath(route.path), requireAuth)`, correct `successStatus`, `...globalErrorResponses` last.
- [ ] Writes use `actorId`, log to the activity log **after** commit, and invalidate caches after commit.
- [ ] Check-then-write flows are in a transaction with `lockOrg` and backed by a named unique index.
- [ ] Permission keys exist in `PERMISSION_CATALOG`; system roles updated if needed.
- [ ] `index.ts` barrel exports updated; router mounted in the app.
- [ ] `SPEC.md` updated (rules, error codes, file tree).
- [ ] Tests added/updated and passing; typecheck and lint pass (use the scripts in `apps/server/package.json`).
- [ ] For refactors: behavior parity confirmed (paths, methods, status codes) or deviations documented in the PR.

---

## 12. Known quirks in the reference module (do not copy)

| Quirk | What to do |
|---|---|
| `deps.ts` of `role` wires `DummyPlanFeatures` (always `true`) in production | Intentional placeholder until real plan/billing exists. New modules wire real implementations or omit the optional port. |
| `role/permission-checker/` (a standalone `PermissionChecker` class with an "ASSUMPTION" comment about column names) | Legacy/alternate. The canonical runtime path is `createPermissionResolver` + `createRbacPermissionChecker` in `role.permissions.ts`. Do not build on it. |
| `_shared.ts` in `role` also exports `createErrorMap`, which no route uses | Use the `rawErrorMap as const` + cast pattern shown in §5 instead. |
| `role.types.ts` and `role.repository.ts` both export `RoleRepository` | New modules declare the type once, in `<module>.types.ts`. |
| `role/SPEC.md` lists an `is_system` column; code derives `isSystem` from `orgId === null` | Code is truth: system role ⇔ `orgId === null`. Fix the SPEC when you touch the module. |
| `role.routes.test.ts` sample DTO uses `assignedCount`, mapper returns `memberCount` | Mock-only drift. In new tests use the real DTO fields. |
| `RequirePermissionOptions` is not exported from `role/index.ts` | Add `export type { RequirePermissionOptions } from "./role.middleware.js"` when first needed. |