# AGENTS.md (apps/platform-server)

The platform (SaaS back office) API: admin identity and roles, plan and catalog configuration, organizations, subscriptions, payments, provider webhooks, scheduled jobs, landing content and the public read API. A separate Cloudflare Worker from `apps/server`.

Specs: `docs/modules/saas-architecture/PLATFORM-ADMIN-SPEC.md` (this app), `SPEC.md` (entitlement model), `LANDING-SPEC.md` (public site API). Status and next tasks: `docs/modules/saas-architecture/PROGRESS.md` (admin track A1 to A8). **Status: A1-02 to A1-04 done.** Identity schema + migrations, roles registry/seed/bootstrap CLI, and the `platform-auth` module (login + TOTP, sessions, invite acceptance) exist; no business modules yet.

## Follow the server conventions
Everything in the root `AGENTS.md` and `apps/server/AGENTS.md` applies here unchanged: module structure under `src/api/modules/<module-name>/` (repository, service, types, permissions, errors, `deps.ts`, `testing.ts`, `hono-routes/`), `Result<T, E>` services, `handleResult` error maps, contracts first in `packages/contracts`, `z` from `@avuny/zod`, unit tests with fakes and integration tests against the real app, activity/audit on every mutation, localized messages through locale files. Reference module for the pattern is `apps/server/src/api/modules/party`.

## What is different here
1. **Separate identity.** Platform admins are not tenant users. Tables are prefixed `platform_` (PLATFORM-ADMIN-SPEC 3.1). A tenant session must never authenticate here and the reverse. Different cookie name (`__Host-` prefix), different secrets.
2. **Permissions per route.** Every route declares a required permission from `PLATFORM_MODULES` (to be added in A1). A test fails for any route without one (PA-R7). Anti-escalation and last-super-admin rules are in PA-R2 to PA-R5.
3. **Audit is append-only.** Every mutating action writes `platform_audit_events` with before and after (PA-R6).
4. **No secrets in responses or logs** (PA-R11).
5. **Webhooks** are mounted outside auth and JSON parsing, read the raw body, verify the provider signature, and write the event ledger before any handler logic (SPEC R18).
6. **Cron.** One tick every 5 minutes dispatches jobs defined in code; schedule and parameters are data (PLATFORM-ADMIN-SPEC section 7). Handlers are idempotent.
7. **Public routes** live under `/api/public/*`, are read-only, serve only published content and carry no tenant data (LANDING-SPEC 4.2).
8. **Shared domain code** goes in `@avuny/entitlements` (resolver, snapshot recompute, plan publish rules). Do not import `apps/server` modules and do not let `apps/server` import this app.
9. **Database.** This app may import `@avuny/db` (root AGENTS.md rule). It is intended to use its own Postgres role with write access to plan and catalog tables; the tenant server gets read-only access there (A7-02).

## Commands
```bash
pnpm --filter @avuny/platform-server dev            # wrangler dev on port 8788
pnpm --filter @avuny/platform-server typecheck
pnpm --filter @avuny/platform-server test            # unit tests, no database
pnpm --filter @avuny/platform-server openapi:generate  # writes openapi/openapi.json for the admin web client
pnpm --filter @avuny/platform-server build
```

## Deployment
Not deployed and not in `.github/workflows/deploy.yml` yet. Adding a deploy job, Cloudflare resources and secrets needs the owner's go-ahead (PROGRESS.md A1-01 and Q23). Non-secret vars belong in `wrangler.jsonc` (a deploy overwrites dashboard plain vars); secrets are set with `wrangler secret put`.
