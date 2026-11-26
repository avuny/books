---
name: api-hono-routes
description: Add or change HTTP endpoints for a module using the repo's Hono + zod-openapi pattern — one *.route.ts file per endpoint, _shared.ts response helpers, errorMap, handleResult, requireAuth, and the module index that mounts them. Use whenever the task says add/change an endpoint, API route, operationId, response status, or error mapping, and whenever a new module needs a backend, even if the user only describes the feature.
---

# API routes (Hono)

Prerequisite: the module's contracts exist (`contracts-module` skill). The service (`<module>.service.ts`) and errors map (`<module>.errors.ts`) live next to `hono-routes/`.

```
apps/server/src/api/modules/project/
├── project.errors.ts        projectErrorsHttpMap (code → { statusCode, responseMessage })
├── project.service.ts       returns Result<Dto, Code>; checks permission + plan limits
└── hono-routes/
    ├── _shared.ts           jsonOk, jsonError, honoPath
    ├── module-routes.types.ts  RouteDeps interface
    ├── list-projects.route.ts
    ├── create-project.route.ts
    ├── update-project.route.ts
    ├── delete-project.route.ts
    └── index.ts
```

## Critical Rule: The `errorMap` and `responses` Type Pairing (Avoid The TS2345 / TS2322 Trap)

When writing Hono OpenAPI routes in this repo, TypeScript enforces two simultaneous constraints on `handleResult`:

1. **HTTP Status Codes Constraint (`SE` in `handleResult`)**:
   Hono's `RouteConfigToTypedResponse` checks that every HTTP status code returned by `handleResult` is declared in `responses: { ... }`.
   If your `rawErrorMap` contains an error with `statusCode: 404` or `422`, but `responses` only declares `201, 403, 409`, TypeScript emits **TS2345**:
   `Types of property '_status' are incompatible. Type '404' is not assignable to type '403'.`

2. **Error Code Union Constraint (`E` in `handleResult`)**:
   `handleResult` requires `errorMap: Record<E, ...>` where `E` is the error code union returned by the service (e.g. `ProjectErrorCode | RoleErrorCode`).
   If you try to fix TS2345 by typing `errorMap: Record<NarrowRouteCode, ...>`, TypeScript emits **TS2322**:
   `Type 'Result<Dto, Code>' is not assignable to type 'Result<Dto, NarrowRouteCode>'`.

### The Canonical Solution:
```ts
// 1. rawErrorMap contains ONLY the errors this specific endpoint can return.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED, // 403
  PROJECT_NAME_TAKEN: errors.PROJECT_NAME_TAKEN,                   // 409
} as const

// 2. The double-satisfaction cast:
// - Keys: `Code | RoleErrorCode` (wide: satisfies result: Result<Dto, Code | RoleErrorCode>)
// - Values: `(typeof rawErrorMap)[keyof typeof rawErrorMap]` (narrow: preserves ONLY 403 | 409 status codes)
const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

// 3. responses: MUST declare exactly the status codes present in rawErrorMap
responses: {
  201: jsonOk("Project created", ProjectDtoSchema),
  403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
  409: jsonError("Conflict", [Code.PROJECT_NAME_TAKEN]),
  ...globalErrorResponses,
}
```
**Never put module errors in `rawErrorMap` that this endpoint cannot return!**
If `responses` does not declare `404`, `rawErrorMap` MUST NOT contain any 404 error codes.

### More traps (found building purchase-order; each costs several tsc rounds)

- **Cast fallback.** `rawErrorMap as Record<Code | RoleErrorCode, ...>` compiles when the map has the keys of the narrow union. If tsc says "Conversion of type ... may be a mistake" (TS2352), use `rawErrorMap as unknown as Record<...>`. Same runtime, same typing result.
- **`ok` / `fail` take one object.** `ok(dto)` is TS2345. Use `ok({ data: dto, msg })` and `fail({ error: Code.X, msg })`.
- **Literal status keys.** `responses` keys must be literal numbers (`201`, `404`), and every `statusCode` in `rawErrorMap` must have a matching key. A shared error map reused across routes breaks this; build one `rawErrorMap` per route.
- **Route order.** Register fixed paths (`/next-number`, `/export`) before `/{id}` routes in `hono-routes/index.ts`, or `{id}` swallows them.
- **Validation errors are 422.** Body/query/param validation failures return 422 from the shared hook. Tests must expect 422, not 400.
- **Registry first.** `PermissionKey` and `ActivityLogAction` come from `packages/contracts/src/modules/registry.ts`. Add the module there and rebuild contracts before writing services, or every permission string errors.
- **Server locales.** Create `apps/server/src/api/intl/locales/<module>/{en,ar}.json` containing only `errors`, then run `pnpm --filter @avuny/books-server intl:generate` (also part of `typecheck`).
- **Mount names are camelCase** in `routes.ts` (`/paymentTerm`, `/purchaseOrder`); `pnpm --filter @avuny/books-server routes:generate` rewrites that file from the module folders.
- **Route tests with a mocked service** are unit tests (`pnpm exec vitest run --project unit`), need no database, and catch status-code mapping mistakes cheaply. See `purchase-order/__tests__/purchase-order.routes.test.ts`.

---

## Step 1 — `_shared.ts` (copy verbatim into the new module)

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
    "application/json": {
      schema: createDomainErrorResponseSchema([...codes] as never),
    },
  },
})

/** "/organizations/{orgId}/projects" -> "/organizations/:orgId/projects" */
export const honoPath = (openApiPath: string) =>
  openApiPath.replace(/\{([^}]+)\}/g, ":$1")
```

## Step 2 — `module-routes.types.ts`

Define dependencies injected into route factories:
```ts
import type { MiddlewareHandler } from "hono"
import type { ProjectService } from "../project.service.js"

export interface RouteDeps {
  service: ProjectService
  requireAuth: MiddlewareHandler
}
```

## Step 3 — Route files (Closure Factory Pattern)

### Template: create (POST, body, 201)

```ts
// create-project.route.ts
import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { projectErrorsHttpMap as errors } from "../project.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import {
  CreateProjectSchema,
  ProjectDtoSchema,
  ProjectErrorCode as Code,
} from "@avuny/contracts"
import { RoleErrorCode } from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  PROJECT_NAME_TAKEN: errors.PROJECT_NAME_TAKEN,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createProjectRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/projects",
    operationId: "createProject",              // → web hook useCreateProject
    tags: ["project"],
    summary: "Create a project in the organization",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateProjectSchema } } },
    },
    responses: {
      201: jsonOk("Project created", ProjectDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.PROJECT_NAME_TAKEN]),
      ...globalErrorResponses,                 // always last
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.create(user.id, orgId, body)
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "project",                   // selects the locale namespace
    })
  })

  return router
}

export default createProjectRoute
```

### Variations (change only these lines)

| Endpoint | method / path | request | responses | rawErrorMap | service call |
|---|---|---|---|---|---|
| list | `get` `/organizations/{orgId}/projects` | `params` + `query: ProjectOffsetListQuerySchema` | `200` `ProjectOffsetListResponseSchema`, `403` | `ROLE_PERMISSION_DENIED` | `service.list(user.id, orgId, query)` |
| get | `get` `/organizations/{orgId}/projects/{projectId}` | `params` (orgId, projectId) | `200` `ProjectDtoSchema`, `403`, `404` | `ROLE_PERMISSION_DENIED`, `PROJECT_NOT_FOUND` | `service.get(user.id, orgId, projectId)` |
| update | `patch` same path | params + body `UpdateProjectSchema` | `200`, `403`, `404`, `409` | `ROLE_PERMISSION_DENIED`, `PROJECT_NOT_FOUND`, `PROJECT_NAME_TAKEN` | `service.update(user.id, orgId, projectId, body)` |
| delete | `delete` same path | params | `200` `DeleteProjectResponseSchema`, `403`, `404` | `ROLE_PERMISSION_DENIED`, `PROJECT_NOT_FOUND` | `service.remove(user.id, orgId, projectId)` |

## Step 4 — Mount in `hono-routes/index.ts`

```ts
import { createOpenAPIRouter } from "@avuny/hono"
import { createProjectRoute } from "./create-project.route.js"
import { listProjectsRoute } from "./list-projects.route.js"
import { getProjectRoute } from "./get-project.route.js"
import { updateProjectRoute } from "./update-project.route.js"
import { deleteProjectRoute } from "./delete-project.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createProjectRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listProjectsRoute(deps))
  router.route("/", createProjectRoute(deps))
  router.route("/", getProjectRoute(deps))
  router.route("/", updateProjectRoute(deps))
  router.route("/", deleteProjectRoute(deps))

  return router
}
```

And in `deps.ts`:
```ts
export const projectRoutes = createProjectRoutes({
  get service() { return getProjectService() },
  requireAuth,
})
```

Then mount `projectRoutes` at `"/"` in `apps/server/src/api/routes.ts`.

## Step 5 — Service contract (what routes expect)

```ts
// signature style: (actorUserId, orgId, …input) => Promise<Result<Dto, Code | RoleErrorCode>>
async create(actorId: string, orgId: string, input: CreateProjectInput): Promise<Result<ProjectDto, Code | RoleErrorCode>> {
  if (!(await canAccess(actorId, "create:project", orgId))) {
    return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "Permission denied" })
  }
  // 1. plan limits  2. business rules  3. DB write  4. audit event
  return ok({ data: dto, msg: "Project created" })
}
```

Permission checks stay **in the service** today. Don't add route-level permission middleware unless asked.

## Step 6 — Regenerate the client

After any route change:
```bash
pnpm openapi:generate && pnpm api:generate
```
Hook names follow `operationId` (`listProjects` → `useListProjects`, `getListProjectsQueryKey`). Mutation variables are `{ orgId, projectId, data }` (path params + `data` for the body).

## Checklist

- [ ] Each endpoint has a unique camelCase `operationId`
- [ ] Every code in `rawErrorMap` has its `statusCode` declared in `responses: { ... }`
- [ ] `errorMap` uses the cast `rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>`
- [ ] `...globalErrorResponses` last in each `responses`
- [ ] `requireAuth` in both `middleware` **and** `router.use` (or deliberately public + commented)
- [ ] No business logic in handlers
- [ ] Registered in `hono-routes/index.ts` and `apps/server/src/api/routes.ts`
- [ ] Client regenerated
