# Rule: Hono API routes

- File: `hono-routes/<verb>-<resource>.route.ts`; default-export a router; named-export the route object (`createProjectRoute`).
- Path in `createRoute` uses OpenAPI braces `/organizations/{orgId}/projects`; convert with `honoPath()` for `router.use`.
- `operationId`: `<verb><Resource>` camelCase (`listProjects`, `createProject`, `deleteProject`). Unique across the whole API.
- `tags: ["<module-kebab>"]`; `summary` is a sentence a human can read in Swagger.
- `middleware: [requireAuth] as const` **and** `router.use(honoPath(route.path), requireAuth)` for authed routes. Public routes omit both and carry a comment (+ rate-limit note).
- `responses`: status codes are **literal keys**; use `jsonOk(description, Schema)` / `jsonError(description, [Code.X, …])`; always spread `...globalErrorResponses` last.
- Status map: 400 bad input · 401 unauth · 403 forbidden/plan-channel · 404 not found · 409 state conflict/limit · 410 expired · 422 semantically unusable input · 429 throttled.
- Handler shape: `errorTrans` → `user` → `valid(...)` → `service.method(user.id, …)` → `handleResult({ c, result, successStatus, errorMap, errorTrans, moduleName })`.
- `errorMap` lists **only** codes this route can return, cast to `Record<Code, …>`.
- Handlers contain **no business logic**. Permission checks, plan limits, audit, DB access live in the service.
- A handler whose service call cannot fail may answer directly (`c.json({ success: true, data }, 200)`); keep the `if (!result.success) throw` guard.
- Register in `hono-routes/index.ts`; the module router is mounted at `"/"` because paths are absolute.
