# AGENTS.md (packages/hono)

Shared Hono middleware, route helpers (`createOpenAPIRouter`), result handler (`handleResult`), and request language resolution.

## Rules

- Only `@avuny/hono` is permitted to use `node:async_hooks` (for request context and language).
- `handleResult`: translates domain `Result` from `@avuny/utils` to HTTP responses and OpenAPI schemas.
- `resolveRequestLanguageMiddleware`: sets language once per request.
