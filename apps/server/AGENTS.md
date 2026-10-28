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

# Run a single test file
pnpm --filter @avuny/books-server test <filename>.spec.ts

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

apps/server/src/api/modules/<module>/      <-- 3. Server Feature Module
  ├── <module>.errors.ts                   <-- HTTP status mapping for domain errors
  ├── <module>.repository.ts               <-- Pure Drizzle DB queries & transactions
  ├── <module>.service.ts                  <-- Core business rules (returns Result<T, E>) & Port Dummies
  ├── <module>.service.spec.ts             <-- Vitest isolated unit tests
  ├── hono-routes/                         <-- OpenAPI HTTP controllers
  │   ├── <action>-<entity>.route.ts
  │   └── index.ts                         <-- Combines routes into <module>Routes router
  └── index.ts                             <-- Module Public API (ONLY file other modules may import)

apps/server/src/api/intl/                  <-- 4. Server i18n registration
  ├── locales/<module>/{en,ar}.json
  └── i18next.ts

apps/server/src/api/routes.ts              <-- 5. Mount module router on main app
```

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

### Step 4: Implement Domain Service (`<module>.service.ts`)

- **Domain Result Handling**: Always return `Result<T, E>` (`ok({ data, msg })` or `fail({ error: Err.<CODE>, msg })`) from `@avuny/utils`. Never throw expected business errors.
- **Port Interfaces & Dependency Injection**:
  Define explicit port interfaces for external services (e.g., `PermissionChecker`, `Cache`, `ActivityLog`, `Limits`).
- **Dummy Fallbacks**:
  Implement dummy fallback classes for ports so routes can run out-of-the-box before full infrastructure is wired:
  ```ts
  export class DummyPermissionChecker implements PermissionChecker {
    async check(): Promise<boolean> {
      return true
    }
  }
  export class DummyCache implements Cache {
    async get<T>(): Promise<T | null> {
      return null
    }
    async set(): Promise<void> {}
    async del(): Promise<void> {}
  }
  ```
- **Service Factory & Default Instance**:
  Export `create<Entity>Service(deps)` and a default instantiated service `export const <entity>Service = createDefault<Entity>Service()`.

---

### Step 5: Unit Tests (`<module>.service.spec.ts`)

- Use `vitest` (`describe`, `it`, `expect`, `vi`).
- Mock dependencies via `vi.fn()` and verify:
  1. Successful business operations.
  2. Transaction commit / rollback and audit logging.
  3. Permission and authorization rejections.
  4. Uniqueness / limit collision handling.
  5. Cache hit / miss / invalidation behavior.

---

### Step 6: OpenAPI HTTP Routes (`hono-routes/`)

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

### Step 7: Module Public API (`<module>/index.ts`)

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

### Step 8: Wire Server i18n & Mount Routes

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

### Step 9: Re-generate Client & Validate

1. Run `pnpm openapi:generate` to regenerate the OpenAPI specification.
2. Run `pnpm api:generate` to update TanStack Query hooks in `apps/web`.
3. Run `pnpm typecheck` to verify end-to-end type safety across the entire repository.

---

## Strict Engineering Rules for AI Agents

1. **Import Paths**:
   - Always include the `.js` extension when importing local TypeScript files (e.g., `import ... from "./foo.js"`).
   - Always import `z` from `@avuny/zod`.
   - Never import `@avuny/db` into contracts, utils, or web apps.
2. **Error Responses in OpenAPI**:
   - Always include `...globalErrorResponses` in `createRoute.responses`.
   - Any domain error returned by `handleResult` must be documented with `createDomainErrorResponseSchema([ErrorCode])` under the matching HTTP status code.
   - For handlers that always succeed and return typed JSON directly, use `return c.json({ success: true, data: result.data }, 200)`.
3. **Authentication & Context**:
   - Protected routes must define `middleware: [requireAuth] as const` on `createRoute` and call `router.use(..., requireAuth)`.
   - Access current user using `c.get("user")` or `c.var.user`.
4. **Database Seed Scripts & Full State Synchronization**:
   - Seed scripts (e.g. `sidebar.seed.ts`, `role.seed.ts`) must be declarative, idempotent, and fully synchronizing.
   - **Never only insert or upsert**: When seed arrays are edited and items/options/headings are removed, the database MUST reflect that removal.
   - Always delete stale rows using `delete(...).where(notInArray(table.key, targetKeys))` inside the seed transaction so removed items are cleaned up.
   - Running the seed script must guarantee that the database strictly matches the seed definition array and contains no leftover or orphaned rows.
