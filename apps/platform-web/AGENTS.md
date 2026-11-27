# AGENTS.md (apps/platform-web)

The platform admin web app (SaaS back office): admin sign-in, admin users and roles, plans and feature matrix editor, catalog and sidebar viewer, organizations, subscriptions, payments, jobs and reminders, landing content editor. Talks only to `apps/platform-server`.

Specs: `docs/modules/saas-architecture/PLATFORM-ADMIN-SPEC.md`, `LANDING-SPEC.md`, status in `PROGRESS.md` (admin track A1 to A8). **This app is a scaffold: one placeholder page. No business logic yet.**

## Follow the web conventions
Everything in the root `AGENTS.md` and `apps/web/AGENTS.md` applies here unchanged: feature modules under `src/features/<name>-module/`, TanStack file-based routes in `src/routes`, the 3-layer form architecture (`docs/FORMS.md`), zero hardcoded strings (`docs/COPY.md`), semantic theme tokens and small injectable components (`docs/FRONTEND.md`), Orval-generated queries in `src/api`, shared UI from `@workspace/ui`, `z` from `@avuny/zod`, tests per `docs/TESTING.md`. Reference feature for the pattern: `apps/web/src/features/party-module`.

## What is different here
1. **Separate app, separate identity.** The API is `apps/platform-server`, never `apps/server`. Auth is the admin session cookie (`withCredentials`); there are no bearer tokens, no organization header and no tenant selection. Generated client: `pnpm --filter @avuny/platform-web api:generate` (reads `../platform-server/openapi/openapi.json`).
2. **Permissions drive the UI.** Hide or disable actions the signed-in admin lacks, but the server is the authority (PA-R7). Permission keys come from the platform registry, not the tenant one.
3. **English only in v1** (decision Q22). Strings live in `src/i18n/locales/en/*.json` for app shell copy; domain copy for platform modules goes in `@avuny/contracts/<module>/locales` like the tenant app so Arabic can be added later without touching components.
4. **Never show secrets** (password hashes, TOTP secrets, tokens, full card data) and never log them (PA-R11).
5. **Dangerous actions** (refund, suspend, publish plan, apply now, publish site) ask for a reason in the UI; the reason is sent to the server and audited.
6. **No indexing.** `noindex` meta stays on.
7. **Plan editing** (the most important screen) follows PLATFORM-ADMIN-SPEC section 4: matrix editor, drafts, impact preview before publish, history and rollback.

## Commands
```bash
pnpm --filter @avuny/platform-web dev        # http://localhost:5174 (API expected on :8788, set VITE_PLATFORM_API_URL to change)
pnpm --filter @avuny/platform-web typecheck
pnpm --filter @avuny/platform-web test
pnpm --filter @avuny/platform-web build
```

## Deployment
Not deployed and not in `.github/workflows/deploy.yml` yet. Worker name `avuny-platform-web` in `wrangler.jsonc` is a placeholder until the owner approves Cloudflare resources and the hostname (decision Q23).
