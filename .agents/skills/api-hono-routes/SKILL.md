---
name: api-hono-routes
description: Add or change HTTP endpoints for a module using the repo's Hono + zod-openapi pattern — one *.route.ts file per endpoint, _shared.ts response helpers, errorMap, handleResult, requireAuth, and the module index that mounts them. Use whenever the task says add/change an endpoint, API route, operationId, response status, or error mapping, and whenever a new module needs a backend, even if the user only describes the feature.
---

# API routes (Hono)

Prerequisite: the module's contracts exist (`contracts-module` skill). The service (`<module>.service.ts`) and errors map (`<module>.errors.ts`) live next to `hono-routes/`.

```
apps/api/src/modules/project/          ⚠ verify base path
├── project.errors.ts        projectErrorsHttpMap  (code → { status, msg key })  ⚠ copy shape from organization-invitation.errors.ts
├── project.service.ts       returns Result<Dto, Code>; checks permission + plan limits
└── hono-routes/
    ├── _shared.ts
    ├── list-projects.route.ts
    ├── create-project.route.ts
    ├── update-project.route.ts
    ├── delete-project.route.ts
    └── index.ts
```

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

## Step 2 — one route file per endpoint

### Template: create (POST, body, 201)

```ts
// create-project.route.ts
import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { projectErrorsHttpMap as errors } from "../project.errors.js"
import { projectService } from "../project.service.js"
import { requireAuth } from "../../auth/index.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import {
  CreateProjectSchema,
  ProjectDtoSchema,
  ProjectErrorCode as Code,
} from "@avuny/contracts"

const router = createOpenAPIRouter()

// ONLY the codes this endpoint can return.
const rawErrorMap = {
  PROJECT_FORBIDDEN: errors.PROJECT_FORBIDDEN,
  PROJECT_NAME_TAKEN: errors.PROJECT_NAME_TAKEN,
  PROJECT_LIMIT_REACHED: errors.PROJECT_LIMIT_REACHED,
} as const
const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createProjectRoute = createRoute({
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
    403: jsonError("Forbidden", [Code.PROJECT_FORBIDDEN]),
    409: jsonError("Conflict", [Code.PROJECT_NAME_TAKEN, Code.PROJECT_LIMIT_REACHED]),
    ...globalErrorResponses,                 // always last
  },
})

router.use(honoPath(createProjectRoute.path), requireAuth)

router.openapi(createProjectRoute, async (c) => {
  const errorTrans = trans({ lang: getRequestLocale() })
  const user = c.get("user")
  const { orgId } = c.req.valid("param")
  const body = c.req.valid("json")

  const result = await projectService.create(user.id, orgId, body)
  return handleResult({
    c,
    result,
    successStatus: 201,
    errorMap,
    errorTrans,
    moduleName: "project",                   // selects the locale namespace
  })
})

export default router
```

### Variations (change only these lines)

| Endpoint | method / path | request | success | service call |
|---|---|---|---|---|
| list | `get` `/organizations/{orgId}/projects` | `params` + `query: ProjectOffsetListQuerySchema` | `200` `ProjectOffsetListResponseSchema` | `projectService.list(user.id, orgId, query)` with `c.req.valid("query")` |
| get | `get` `/organizations/{orgId}/projects/{projectId}` | `params` (both uuid) | `200` `ProjectDtoSchema` | `.get(user.id, orgId, projectId)` |
| update | `patch` same path | params + body `UpdateProjectSchema` | `200` | `.update(user.id, orgId, projectId, body)` |
| delete | `delete` same path | params | `200` `DeleteProjectResponseSchema` | `.remove(user.id, orgId, projectId)` |
| action | `post` `…/{projectId}/archive` | params | `200` | `.archive(…)` — verbs as sub-paths, like `/revoke`, `/resend` |

`get`/`update`/`delete` add `PROJECT_NOT_FOUND` under `404`.

### Public endpoint (no auth)

Drop `middleware` and the `router.use(... requireAuth)` line; add a doc comment and a rate-limit note. Take secrets in the **body** (POST), never the URL — see `preview-organization-invitation.route.ts`.

### Handler that cannot fail

```ts
router.openapi(myProjectsRoute, async (c) => {
  const user = c.get("user")
  const result = await projectService.listMine(user.id)
  if (!result.success) throw new Error("listMine cannot fail")
  return c.json({ success: true, data: result.data }, 200)
})
```

## Step 3 — mount in `hono-routes/index.ts`

```ts
import { createOpenAPIRouter } from "@avuny/hono"
import listProjectsRoute from "./list-projects.route.js"
import createProjectRoute from "./create-project.route.js"
import updateProjectRoute from "./update-project.route.js"
import deleteProjectRoute from "./delete-project.route.js"

/** Paths are absolute (e.g. /organizations/{orgId}/projects), so mount this at "/". */
export const projectRoutes = createOpenAPIRouter()

projectRoutes.route("/", listProjectsRoute)
projectRoutes.route("/", createProjectRoute)
projectRoutes.route("/", updateProjectRoute)
projectRoutes.route("/", deleteProjectRoute)
```

Then mount `projectRoutes` at `"/"` in the app router ⚠ (find where `organizationInvitationRoutes` is mounted and add yours next to it).

## Step 4 — service contract (what routes expect)

```ts
// signature style: (actorUserId, orgId, …input) => Promise<Result<Dto, ErrorCode>>
async create(actorId: string, orgId: string, input: CreateProjectInput) {
  if (!(await canAccess(actorId, "create:project", orgId)))   // 1. permission
    return fail({ error: Code.PROJECT_FORBIDDEN })
  // 2. plan limits (e.g. LIMIT_REACHED)  3. business rules  4. DB write  5. audit event
  return ok(dto)
}
```

Permission checks stay **in the service** today. Don't add route-level permission middleware unless asked.

## Step 5 — regenerate the client

After any route change: `<pnpm … api:generate>` ⚠. Hook names follow `operationId` (`listProjects` → `useListProjects`, `getListProjectsQueryKey`). Mutation variables are `{ orgId, projectId, data }` (path params + `data` for the body).

## Checklist

- [ ] Each endpoint has a unique camelCase `operationId`
- [ ] Every code in `errorMap` appears in a `responses` entry, and vice versa
- [ ] `...globalErrorResponses` last in each `responses`
- [ ] `requireAuth` in both `middleware` **and** `router.use` (or deliberately public + commented)
- [ ] No business logic in handlers
- [ ] Registered in `hono-routes/index.ts` and the app router
- [ ] Client regenerated
