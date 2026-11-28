# Platform admin deploy (avuny-platform-api and avuny-platform-web)

The platform admin apps (`apps/platform-server`, `apps/platform-web`) deploy as two Cloudflare Workers next to the Books Workers. Issue: #111.

## How it works
`.github/workflows/deploy.yml` job `deploy` runs the platform steps after the Books API and web steps. They run only when the repository variable `PLATFORM_DEPLOY_ENABLED` is `true`, so merging this change does not touch production until the owner switches it on. The smoke job checks `/api/health` on the platform API and the platform web root when the same variable is on.

The `verify` job also runs `scripts/check-wrangler-vars.mjs` on `apps/platform-server/wrangler.jsonc` (skipped when the file is absent).

## Owner steps (once, before turning the variable on)
1. Create the two Workers. Either use a Cloudflare API token with Workers write access (Edit Cloudflare Workers template) and let the first deploy create them, or create `avuny-platform-api` and `avuny-platform-web` in the dashboard. The token currently used for reads cannot create Workers.
2. If the GitHub secret `CLOUDFLARE_API_TOKEN` is read-only, replace it with a token that can deploy Workers.
3. Set secrets on `avuny-platform-api` (`wrangler secret put`, never in git):
   - `DATABASE_URL`: a Postgres role separate from the Books role (spec A7-02).
   - `PLATFORM_AUTH_TICKET_SECRET`: at least 32 characters.
   - `PLATFORM_TOTP_ENC_KEY`: at least 32 characters.
4. Set GitHub Actions variables: `VITE_PLATFORM_API_URL` (the platform API origin, for example `https://avuny-platform-api.khaledeveloper.workers.dev`) and `PLATFORM_DEPLOY_ENABLED=true`.
5. Create the first platform admin with `pnpm --filter @avuny/platform-server bootstrap:admin` against the platform database.

## Check after the first deploy
- `GET <platform api>/api/health` returns 200.
- The platform web origin loads and sign-in reaches the API (CORS allows only the platform web origin).
- Look at the prod probe history (`docs/ops/prod-monitoring.md`) and add the platform Workers to it (#114).

## Non-secret values
Non-secret Worker vars live in each `wrangler.jsonc`. A deploy replaces dashboard-set plain variables, so do not set non-secret values in the dashboard.
