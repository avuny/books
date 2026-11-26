# Testing

Three layers, each answering a different question. Write the cheapest layer that can catch the bug.

| Layer | Question it answers | Runs against | Where | Command |
|---|---|---|---|---|
| **Unit** | Is this logic right? (services with fakes, mappers, pure functions) | nothing real | `<module>.service.spec.ts`, `lib/*.test.ts` | `pnpm --filter @avuny/books-server test` |
| **Route integration** | Does the whole backend work through HTTP? (auth, permissions, tenant isolation, real Postgres, error mapping) | real app + real test DB | `<module>/<module>.routes.int.test.ts` | `pnpm --filter @avuny/books-server test:int` |
| **Web e2e** | Can a person complete the journey in a browser? | real browser + real web app + real API + real test DB | `apps/web/e2e/specs/*.e2e.ts` | `pnpm --filter @avuny/books-web e2e` |

Agents: use `.agents/skills/api-integration-tests/SKILL.md` and `.agents/skills/web-e2e-tests/SKILL.md`.

## One-time setup

```bash
docker compose -f apps/server/docker-compose.test.yml up -d --wait     # Postgres + Neon HTTP proxy
pnpm --filter @avuny/books-web exec playwright install chromium         # e2e only
```

No env file is needed: `apps/server/.env.test.example` carries test-only values and the local database URL. Put overrides in `apps/server/.env.test` (git-ignored). Precedence: shell/CI env > `.env.test` > `.env.test.example`. The test runs never read `.env`.

## How the test database works

- **Dedicated database.** `TEST_DATABASE_URL`; the harness refuses any name that does not contain `test` or `e2e`, and any remote host unless `TEST_DB_ALLOW_REMOTE=1` (use that only for a dedicated Neon test branch).
- **Same driver as production.** The app talks Neon HTTP. `db.localtest.me` resolves to 127.0.0.1 and the compose file runs the Neon HTTP proxy in front of plain Postgres, so tests exercise the production code path. (`packages/db/src/client.ts` points the driver at the proxy only for that host.)
- **Lifecycle.** Global setup drops and recreates the `public` schema, applies `packages/db/drizzle/*.sql` in journal order (so migrations are proven from scratch on every run) and seeds reference data (USD/EGP, UTC/Africa-Cairo, system roles, units, sidebar, accounting defaults). Global teardown empties the schema again. `KEEP_TEST_DB=1` keeps the data for inspection.
- **Isolation.** There is no per-test rollback (the HTTP driver has no sessions). Instead every test creates its own user and organization through the real endpoints, so tests never share rows and can run in parallel. Do not run integration tests and e2e at the same time against the same database.
- **External providers.** Email/WhatsApp are replaced by `MESSAGE_SENDER_MODE=capture` (refused when `NODE_ENV=production`). Integration tests read OTPs and invitation links from the in-memory outbox; e2e reads them from `apps/web/.e2e/outbox.jsonl`.

## Things to know

- **`db.transaction` is a pass-through on Neon HTTP.** `createDbClient` runs the callback on the same client with no BEGIN/COMMIT, so a failure in the middle of a "transaction" leaves the earlier writes in place, in production and in these tests. Rules that rely on rollback (module AGENTS.md §5.2) need an interactive-transaction driver (Neon WebSocket pool) or `db.batch` before a test can assert them.
- **Use the production driver.** Other Postgres drivers expose constraint errors under different property names, so repositories that detect unique violations (`organization.repository.ts` reads `err.constraint`) report a 500 instead of a 409.
- Tests that need real data from a seeded database belong in the integration project, not in unit tests (`geo.routes.test.ts` calls the database through its routes today).

## CI

`.github/workflows/tests.yml` runs both suites on every pull request: compose database up, build workspace packages, `test:int`; and for e2e additionally build the server (OpenAPI), `api:generate`, install Chromium, `e2e`. The Playwright report is uploaded when a run fails.
