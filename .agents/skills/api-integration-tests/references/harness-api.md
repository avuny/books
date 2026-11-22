# Harness API (`apps/server/src/api/test-support`)

Import everything from `../../test-support/index.js` (from a module folder).

## Boot

| Call | Purpose |
|---|---|
| `await createTestApp()` → `{ app, anonymous }` | Boots the real Hono app (`src/api/routes.ts`) against the test database. Call in `beforeAll`. `anonymous` is a caller with no token. |

## Arrange (factories — all go through the real endpoints)

| Call | Does |
|---|---|
| `createUser(app, overrides?)` → `TestUser` | send-otp → reads the OTP from the capture outbox → verify → sign-up. Returns `{ id, name, identifier, password, api }`; `api` is an authenticated `ApiClient`. |
| `signIn(app, user)` → `TestUser` | New session and token for an existing user. |
| `createOrganization(owner, overrides?)` → `TestOrganization` | `POST /organizations` as `owner` (USD, UTC, unique code and owner username). |
| `createUserWithOrganization(app)` → `{ owner, org }` | The common starting point. |
| `uniqueId()` | Collision-free suffix for names, codes, emails. |

## Call

`ApiClient` (`user.api`, `t.anonymous`): `get | post | put | patch | delete<T>(path, { json?, query?, headers? })`. Paths are relative to the API base: `"/organizations"` calls `/api/organizations`. Each client has its own bearer token, cookie jar, language (`withLang("ar")`) and client IP, so per-IP rate limits never couple two tests. `withToken(token)` returns the same caller with another token; `anonymous()` returns a fresh unauthenticated caller.

Every response is `{ status, body, headers }` with `body` = `{ success: true, data } | { success: false, code, message, type, errors? }`.

## Assert

| Call | Does |
|---|---|
| `expectOk<T>(res, status?)` → `data` | Fails with the full response if it was not a success (or the status differs). |
| `expectFailure(res, status, code?)` → failure body | Fails with the full response if status or `code` differ. 422 bodies carry `errors`. |
| `getCaptureOutbox()` | The capture message sender: `all()`, `lastOtp(identifier)`, `lastInvitation(identifier)` → `{ link, token }`, `clear()`. |

## Lifecycle of the database

1. **Global setup** (once, `src/api/test-support/global-setup.ts`): drop and recreate the `public` schema → apply `packages/db/drizzle/*.sql` in journal order → seed reference data (USD/EGP, UTC/Africa-Cairo, system roles, units, sidebar, accounting defaults).
2. **Tests**: each creates its own users and organizations. Files run in parallel; they never share rows.
3. **Global teardown**: drops and recreates `public` again, leaving the database empty. `KEEP_TEST_DB=1` skips this so a failing run can be inspected.

Need more reference data than the minimal seed (another currency, a country)? Add it to `seedReferenceData()` in `database.ts`; do not insert it from a test.

## Environment

`apps/server/.env.test` (copy of `.env.test.example`; never `.env`). `loadTestEnv()` forces `NODE_ENV=test`, `DATABASE_URL=$TEST_DATABASE_URL`, `MESSAGE_SENDER_MODE=capture`, `BACKGROUND_RUNNER=inline`, and refuses a database whose name does not contain `test` or `e2e`, or a remote host without `TEST_DB_ALLOW_REMOTE=1`.

## Commands

```bash
docker compose -f apps/server/docker-compose.test.yml up -d --wait   # Postgres + Neon HTTP proxy
pnpm --filter @avuny/books-server test:int                           # all integration tests
pnpm --filter @avuny/books-server test:int organization              # one module (file-name filter)
pnpm --filter @avuny/books-server test:int:watch                     # watch mode
pnpm --filter @avuny/books-server test                               # unit tests only (no database)
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `TEST_DATABASE_URL is not set` | Copy `.env.test.example` to `.env.test`. |
| `Refusing to reset database "…"` | The URL does not point at a test database. Fix the URL; never loosen the guard. |
| `fetch failed` / `ECONNREFUSED` | The compose stack is not running (`docker compose … up -d --wait`). |
| `No OTP was delivered to "…"` | `MESSAGE_SENDER_MODE` is not `capture`, or the flow failed before sending (read the first failure). |
| 429 / `OTP_RATE_LIMITED` | A test reused one identifier or one client for many sign-ups. Use `createUser` (new identifier and client each time). |
| `duplicate key … SERVER_ERROR` (500) | A unique/FK violation the repository does not translate: a production bug, the repository must map the known constraint to a typed reason (module AGENTS.md §4). First rule out the driver: the suite must run on Neon HTTP (the compose proxy), because other Postgres drivers expose constraint names under different property names. |
| Test passes alone, fails in the suite | Shared state or a fixed unique value. Build the data inside the test with the factories. |
