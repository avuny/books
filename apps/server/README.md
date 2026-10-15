# hono-worker-api

Hono + `@hono/zod-openapi` API scaffold, ready to deploy to Cloudflare Workers.

## Getting started

```bash
npm install
cp .dev.vars.example .dev.vars   # local-only overrides
npm run typecheck
npm run dev                      # http://localhost:8787
```

- Health check: `GET /api/health`
- Swagger UI: `GET /api/docs`
- OpenAPI spec: `GET /api/openapi.json`

## Deploy

```bash
npx wrangler login               # once
npm run deploy:dry               # optional: bundle without deploying
npm run deploy
```

Rename the Worker by changing `name` in `wrangler.jsonc`. Plain vars live under
`vars` there; secrets are set with `npx wrangler secret put <NAME>`.

## Structure

```
src/
  index.ts                     Worker entry (exports the Hono app)
  config.ts                    App constants
  types.ts                     Bindings / Variables types
  lib/logger.ts                Structured JSON logger (Workers-safe)
  api/
    index.ts
    routes.ts                  Middleware, route registration, OpenAPI docs
    create-openapi-router.ts   OpenAPIHono factory with the validation hook
    create-log.ts              logHttpRequest helper
    onError.ts                 Global error handler
    health.route.ts            GET /api/health
    middleware/request-logger.ts
    modules/                   Put feature modules here (empty for now)
```

## Adding a module

Create `src/api/modules/<name>/index.ts` exporting a router built with
`createOpenAPIRouter()`, then mount it in `src/api/routes.ts`:

```ts
app.route("/<name>", <name>Routes)
```
