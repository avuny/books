# AGENTS.md (@avuny/books-server)

Guide for AI agents implementing backend feature modules, routes, services, repositories, and OpenAPI endpoints.

---

## Quick Reference Commands

Always run targeted package commands from the monorepo root to verify changes quickly:

```bash
# Typecheck server only (fast)
pnpm --filter @avuny/books-server typecheck

# Run server unit & integration tests
pnpm --filter @avuny/books-server test

# Run a single test file (route tests live in __tests__/)
pnpm --filter @avuny/books-server test <filename>.test.ts

# Service unit tests
pnpm --filter @avuny/books-server test <module>.service.spec.ts

# OpenAPI Spec & Client Generation Pipeline
pnpm intl:generate      # Generates i18next.ts and i18next.d.ts from locales/
pnpm openapi:generate   # Generates apps/server/openapi/openapi.json
pnpm api:generate       # Re-generates Orval client hooks in apps/web

# Full monorepo validation
pnpm typecheck
```

---

## End-to-End Module Architecture (A to Z)

Every feature module in `@avuny/books-server` follows a strict schema-first, hexagonal/clean architecture:

```
packages/contracts/src/<module>/          <-- 1. Single source of truth (Schemas, Errors, DTOs, Locales)
  ├── constants.ts
  ├── errors.ts
  ├── schemas.ts
  ├── locales/{en,ar}.json
  └── index.ts

packages/db/src/schema/<module>/          <-- 2. Drizzle ORM tables & relations (if schema changes needed)
  └── <entity>.ts

apps/server/src/api/modules/<module>/      <-- 3. Server Feature Module (canonical layout)
  ├── SPEC.md                              <-- Module specification & requirements (update on every requirement change)
  ├── deps.ts                              <-- Singleton composition / DI wiring (the ONLY place that imports db & config)
  ├── index.ts                             <-- Public barrel: ONLY file other modules may import
  ├── <module>.errors.ts                   <-- HTTP status mapping for domain errors (re-exports ErrorCode)
  ├── <module>.error-map.ts                <-- Full Code → ErrorMeta map covering ALL error codes
  ├── <module>.repository.ts               <-- Pure Drizzle DB queries & transactions
  ├── <module>.service.ts                  <-- Business logic as closure factory (returns Result<T, E>)
  ├── <module>.service.spec.ts             <-- Vitest isolated service unit tests
  ├── <module>.types.ts                    <-- Service/repo return types + port interfaces
  ├── <module>.mapper.ts                   <-- row → DTO converters (pure, no deps)
  ├── hono-routes/                         <-- OpenAPI HTTP controllers (one file per endpoint)
  │   ├── _shared.ts                       <-- jsonOk / jsonError / honoPath helpers
  │   ├── module-routes.types.ts           <-- RouteDeps interface (service + requireAuth)
  │   ├── index.ts                         <-- Aggregates routes; exports singletons
  │   └── <action>-<entity>.route.ts       <-- One route per HTTP operation
  └── __tests__/                           <-- Route-level tests (one file per route)
      └── <action>-<entity>.route.test.ts

apps/server/src/api/intl/                  <-- 4. Server i18n registration
  ├── locales/<module>/{en,ar}.json
  └── i18next.ts

apps/server/src/api/routes.ts              <-- 5. Mount module router on main app
```

---

## Module File Conventions

### `<module>.types.ts` — Service & Repository Types

This file is the **single point of truth for all TypeScript interfaces and types** that live at the boundary between layers. It must NOT contain logic.

```ts
// Use ReturnType to derive service/repo types from their factory functions:
export type OrganizationInvitationService = ReturnType<typeof createOrganizationInvitationService>
export type OrganizationInvitationRepository = ReturnType<typeof createOrganizationInvitationRepository>

// Port interfaces (implemented outside the module, injected via deps):
export interface InvitationNotifier {
  send(delivery: InvitationDelivery): Promise<void>
}

// Service deps bag:
export interface OrganizationInvitationServiceDeps {
  repo: OrganizationInvitationRepository
  organizationUserService: OrganizationUserService
  roleService: RoleService
  permissions: { check(...): Promise<boolean> }
  // …
}

// Internal repo-layer types that have no equivalent in contracts:
export type InvitationTarget = { identifier?: string | null; inviteeUserId?: string | null }
```

### `deps.ts` — Singleton Composition

The **only** file that knows about the concrete infrastructure (`db`, `config`, other module singletons). It wires everything together and exports a lazy singleton via `get<Module>Service()` + a `Proxy`-based export:

```ts
let _serviceInstance: OrganizationInvitationService | undefined

export function getOrganizationInvitationService(): OrganizationInvitationService {
  if (!_serviceInstance) {
    _serviceInstance = createOrganizationInvitationService({
      repo: createOrganizationInvitationRepository({ db }),
      organizationUserService,  // from org-user/index.js
      roleService,              // from role/index.js
      // …
    })
  }
  return _serviceInstance
}

export const organizationInvitationService = new Proxy({} as OrganizationInvitationService, {
  get(_t, prop) { return (getOrganizationInvitationService() as any)[prop] },
})
```

> [!IMPORTANT]
> `deps.ts` must **never** be imported by other modules. Use `index.ts` exports only.

### `<module>.error-map.ts` — Full Error Map

Provides a single `Record<Code, ErrorMeta>` covering **all** codes in the enum:

```ts
export const organizationInvitationErrorMap = {
  ORGANIZATION_INVITATION_NOT_FOUND: errors.ORGANIZATION_INVITATION_NOT_FOUND,
  // … every code from the enum
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>
```

Route files build **subset** error maps inline from `errors.*`; this file provides the exhaustive union for reuse in tests.

### `hono-routes/module-routes.types.ts` — Route Dependencies

```ts
import type { MiddlewareHandler } from "hono"
import type { OrganizationInvitationService } from "../organization-invitation.types.js"

export interface RouteDeps {
  service: OrganizationInvitationService
  requireAuth: MiddlewareHandler
}
```

All route factories accept `(deps: RouteDeps)` — never the concrete service or middleware directly.

### `__tests__/<action>-<entity>.route.test.ts` — Route Tests

Each route file has a parallel test file. Tests use a mock `service` and a mock `requireAuth` middleware; they never import `deps.ts` or touch the database.

```ts
const mockRequireAuth: MiddlewareHandler = async (c, next) => {
  c.set("user", { id: "uuid..." })
  await next()
}
const mockService: any = { create: vi.fn().mockResolvedValue(ok({ data: {...}, msg: "..." })) }
```

### `SPEC.md` — Module Specification

Every module with non-trivial business rules must have a `SPEC.md` at the module root. It documents:
- Domain model
- Business rules (creation, validation, side effects)
- Error codes table
- Routes summary
- File structure
- Dependency rules

**Update `SPEC.md` whenever a requirement changes.**

---

## Step-by-Step Implementation Workflow

### Step 1: Define Contracts (`packages/contracts/src/<module>/`)

1. **`constants.ts`**:
   - Define validation bounds (e.g. `MIN_LENGTH`, `MAX_LENGTH`), regex patterns, and default pagination constants.
2. **`errors.ts`**:
   - Define domain error code enum:
     ```ts
     export const OrganizationErrorCode = {
       ORGANIZATION_NOT_FOUND: "ORGANIZATION_NOT_FOUND",
       ORGANIZATION_FORBIDDEN: "ORGANIZATION_FORBIDDEN",
     } as const
     export type OrganizationErrorCode =
       (typeof OrganizationErrorCode)[keyof typeof OrganizationErrorCode]
     ```
3. **`schemas.ts`**:
   - **Always** import `z` from `@avuny/zod` (never from `zod` directly).
   - Define and infer input schemas (`Create<Entity>Schema`), DTO schemas (`<Entity>DtoSchema`), list query schemas (`<Entity>OffsetListQuerySchema`), and response schemas (`<Entity>OffsetListResponseSchema`).
   - Use `z.coerce.number()` for URL query parameters.
4. **`locales/{en,ar}.json`**:
   - Provide translation keys under `"errors"`, `"labels"`, and `"msgs"`.
5. Export everything in `packages/contracts/src/<module>/index.ts` and `packages/contracts/src/index.ts`.

---

### Step 2: Define Errors & HTTP Mapping (`<module>.errors.ts`)

Map domain errors to HTTP status codes using `@avuny/utils` `ErrorMeta`:

```ts
import { OrganizationErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { OrganizationErrorCode }

export const organizationErrorsHttpMap = {
  ORGANIZATION_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Organization not found",
  },
  ORGANIZATION_FORBIDDEN: {
    statusCode: 403,
    responseMessage: "You are not allowed to perform this action",
  },
  ORGANIZATION_NAME_TAKEN: {
    statusCode: 409,
    responseMessage: "You already have an organization with this name",
  },
} as const satisfies Record<OrganizationErrorCode, ErrorMeta>
```

---

### Step 3: Implement Database Repository (`<module>.repository.ts`)

- **Rule**: Only `@avuny/books-server` may import from `@avuny/db`.
- Wrap queries inside a repository factory function: `create<Entity>Repository({ db }: { db: DB })`.
- Use `exec(tx?: Tx): DB | Tx => tx ?? db` to support atomic transactions.
- Handle PostgreSQL errors safely (e.g., `isUniqueViolation(err, constraint)`).
- Use advisory locks (`sql select pg_advisory_xact_lock(...)`) when serializing race-sensitive checks across transactions.
- Export repository type: `export type <Entity>Repository = ReturnType<typeof create<Entity>Repository>`.

---

### Step 4: Define Module Types (`<module>.types.ts`)

Create `<module>.types.ts` for all type definitions that live at the layer boundary:
- `ReturnType<typeof create<Module>Service>` and `ReturnType<typeof create<Module>Repository>` as named service/repo types.
- Port interfaces (`InvitationNotifier`, `UserDirectory`, etc.).
- The deps bag interface (`<Module>ServiceDeps`).
- Internal repository-layer types not present in contracts (e.g. `InvitationTarget`, `InvitationWithOrganization`).

> [!IMPORTANT]
> Import contract types (input shapes, DTOs, error codes) from `@avuny/contracts`. Types local to the server layer belong here.

---

### Step 5: Implement Domain Service (`<module>.service.ts`)

- **Always use the closure factory pattern**: `export const create<Module>Service = (deps: <Module>ServiceDeps) => { ... return { method1, method2, ... } }`
- **Never export a class** for the service.
- **Port Interfaces** are defined in `<module>.types.ts`, not in the service file.
- **Domain Result Handling**: Always return `Result<T, E>` (`ok({ data, msg })` or `fail({ error: Err.<CODE>, msg })`) from `@avuny/utils`. Never throw expected business errors.
- **Dummy Fallbacks**:
  Implement dummy fallback classes for ports so routes can run out-of-the-box before full infrastructure is wired:
  ```ts
  export class DummyPermissionChecker implements PermissionChecker {
    async check(): Promise<boolean> {
      return true
    }
  }
  ```
- **Never import the repository** — receive it as `repo` in the deps bag.
- **Inter-module dependencies**: accept other modules' services via their types from `../other-module/index.js`, not repositories.

---

### Step 6: Compose Dependencies (`deps.ts`)

Wire concrete implementations in `deps.ts`. See the **Module File Conventions → `deps.ts`** section above for the pattern.

---

### Step 7: Unit Tests (`<module>.service.spec.ts`)

- Use `vitest` (`describe`, `it`, `expect`, `vi`).
- Mock dependencies via `vi.fn()` and verify:
  1. Successful business operations.
  2. Transaction commit / rollback and audit logging.
  3. Permission and authorization rejections.
  4. Uniqueness / limit collision handling.
  5. Cache hit / miss / invalidation behavior.

---

### Step 8: OpenAPI HTTP Routes (`hono-routes/`)

Create dedicated route files under `src/api/modules/<module>/hono-routes/`:

- `create-<entity>.route.ts` (POST `/`)
- `get-<entity>.route.ts` (GET `/{id}`)
- `update-<entity>.route.ts` (PATCH `/{id}`)
- `<entity>-list.route.ts` (GET `/`)
- `index.ts` (aggregates into `<module>Routes`)

#### Route Pattern Standard:

```ts
import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import {
  createOpenAPIRouter,
  handleResult,
  getRequestLocale,
} from "@avuny/hono"
import { OrganizationDtoSchema, OrganizationErrorCode } from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { organizationErrorsHttpMap } from "../organization.errors.js"
import { organizationService } from "../organization.service.js"
import { requireAuth } from "../../auth/index.js"

const router = createOpenAPIRouter()

const getOrganizationErrorMap = {
  ORGANIZATION_NOT_FOUND: organizationErrorsHttpMap.ORGANIZATION_NOT_FOUND,
  ORGANIZATION_FORBIDDEN: organizationErrorsHttpMap.ORGANIZATION_FORBIDDEN,
} as const

export const getOrganizationRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getOrganization",
  tags: ["organization"],
  summary: "Get organization by ID",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Organization retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(OrganizationDtoSchema),
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_FORBIDDEN,
          ]),
        },
      },
    },
    404: {
      description: "Organization not found",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OrganizationErrorCode.ORGANIZATION_NOT_FOUND,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.use("/:id", requireAuth)

router.openapi(getOrganizationRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.get("user")
  const { id } = c.req.valid("param")

  const result = await organizationService.getById(user.id, id)

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: getOrganizationErrorMap,
    errorTrans,
    moduleName: "organization",
  })
})

export default router
```

#### Hono Routes Aggregator (`hono-routes/index.ts`):

```ts
import { createOpenAPIRouter } from "@avuny/hono"
import createOrganizationRoute from "./create-organization.route.js"
import getOrganizationRoute from "./get-organization.route.js"
import updateOrganizationRoute from "./update-organization.route.js"
import organizationListRoute from "./organization-list.route.js"

export const organizationRoutes = createOpenAPIRouter()

organizationRoutes.route("/", organizationListRoute)
organizationRoutes.route("/", createOrganizationRoute)
organizationRoutes.route("/", getOrganizationRoute)
organizationRoutes.route("/", updateOrganizationRoute)
```

---

### Step 9: Route Tests (`__tests__/`)

Create one test file per route under `__tests__/`:

```ts
// __tests__/create-entity.route.test.ts
import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { ok, fail } from "@avuny/utils"
import { createEntityRoute } from "../hono-routes/create-entity.route.js"
import { EntityErrorCode } from "@avuny/contracts"

describe("createEntityRoute", () => {
  const mockUser = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01" }
  const mockRequireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", mockUser)
    await next()
  }

  it("returns 201 on success", async () => {
    const mockService: any = { create: vi.fn().mockResolvedValue(ok({ data: {...}, msg: "Created" })) }
    const app = createOpenAPIRouter()
    app.route("/", createEntityRoute({ service: mockService, requireAuth: mockRequireAuth }))
    const res = await app.request("/entities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...}) })
    expect(res.status).toBe(201)
  })

  it("returns 403 when forbidden", async () => {
    const mockService: any = { create: vi.fn().mockResolvedValue(fail({ error: EntityErrorCode.ENTITY_FORBIDDEN, msg: "No" })) }
    // ...
  })
})
```

> [!IMPORTANT]
> Route tests **never** import `deps.ts`. They receive a mock service and mock `requireAuth`. They test HTTP status codes and response shapes.

---

### Step 10: Module Public API (`<module>/index.ts`)

Create a clean barrel export at the module root.
**Critical Rule**: Outside modules must **only** import from `apps/server/src/api/modules/<module>/index.js`, never from internal paths.

```ts
// apps/server/src/api/modules/organization/index.ts
export {
  OrganizationErrorCode,
  organizationErrorsHttpMap,
} from "./organization.errors.js"
export {
  createOrganizationService,
  createDefaultOrganizationService,
  organizationService,
  type OrganizationService,
} from "./organization.service.js"
export {
  createOrganizationRepository,
  type OrganizationRepository,
} from "./organization.repository.js"
export { organizationRoutes } from "./hono-routes/index.js"
```

> [!CAUTION]
> **DO NOT** create route forwarding files directly inside the module root (e.g. `modules/organization/create-organization.route.ts`). All route files belong strictly in `hono-routes/`.

---

### Step 10: Wire Server i18n & Mount Routes

1. **Copy or link locales to server intl**:
   Create `apps/server/src/api/intl/locales/<module>/{en,ar}.json` with error keys:
   ```json
   {
     "errors": {
       "ORGANIZATION_NOT_FOUND": "Organization not found."
     }
   }
   ```
2. **Register in `apps/server/src/api/intl/i18next.ts` & `i18next.d.ts`**:
   Run `pnpm intl:generate` (or `pnpm --filter @avuny/books-server intl:generate`) to automatically scan `apps/server/src/api/intl/locales/` and regenerate `i18next.ts` and `i18next.d.ts`. This is also automatically executed before `typecheck` and `build`.
3. **Mount in `apps/server/src/api/routes.ts`**:
   ```ts
   import { organizationRoutes } from "./modules/organization/index.js"
   ...
   app.route("/organizations", organizationRoutes)
   ```

---

### Step 11: Re-generate Client & Validate

1. Run `pnpm openapi:generate` to regenerate the OpenAPI specification.
2. Run `pnpm api:generate` to update TanStack Query hooks in `apps/web`.
3. Run `pnpm typecheck` to verify end-to-end type safety across the entire repository.

---

## Strict Engineering Rules for AI Agents

1. **Import Paths**:
   - Always include the `.js` extension when importing local TypeScript files (e.g., `import ... from "./foo.js"`).
   - Always import `z` from `@avuny/zod`.
   - Never import `@avuny/db` into contracts, utils, or web apps.
2. **Module Boundaries**:
   - Other modules must **only** import from a module's `index.ts` — never from internal paths like `.service.js`, `.repository.js`, or `deps.js`.
   - `deps.ts` is private to the module; it must never be imported by external modules.
   - A module's service must **never** import another module's repository. Import only the other module's service via its `index.ts`.
3. **Service Pattern**:
   - Use the **closure factory** (`export const createService = (deps) => { ... return { method } }`), not classes.
   - All deps (repo, permissions, limits, activityLog, etc.) are injected via the deps bag.
   - Port interfaces live in `<module>.types.ts`, not in the service file.
4. **Error Responses in OpenAPI**:
   - Always include `...globalErrorResponses` in `createRoute.responses`.
   - Any domain error returned by `handleResult` must be documented with `createDomainErrorResponseSchema([ErrorCode])` under the matching HTTP status code.
   - For handlers that always succeed and return typed JSON directly, use `return c.json({ success: true, data: result.data }, 200)`.
5. **Authentication & Context**:
   - Protected routes must define `middleware: [requireAuth] as const` on `createRoute` and call `router.use(..., requireAuth)`.
   - Access current user using `c.get("user")` or `c.var.user`.
6. **Database Seed Scripts & Full State Synchronization**:
   - Seed scripts (e.g. `sidebar.seed.ts`, `role.seed.ts`) must be declarative, idempotent, and fully synchronizing.
   - **Never only insert or upsert**: When seed arrays are edited and items/options/headings are removed, the database MUST reflect that removal.
   - Always delete stale rows using `delete(...).where(notInArray(table.key, targetKeys))` inside the seed transaction so removed items are cleaned up.
   - Running the seed script must guarantee that the database strictly matches the seed definition array and contains no leftover or orphaned rows.
7. **SPEC.md**:
   - Modules with non-trivial business rules must have a `SPEC.md` at their root.
   - **Update `SPEC.md` whenever a requirement changes**: new error code, new route, changed policy, new delivery channel, etc.
8. **Messaging & Notifications**:
   - Always use the messaging module (`getMessageSender()` from `../messaging/index.js`) for outbound notifications (email, WhatsApp, SMS).
   - Never call an email/SMS/WhatsApp API directly from a service or route. Use `MessageSender` through the notifier adapter pattern.
