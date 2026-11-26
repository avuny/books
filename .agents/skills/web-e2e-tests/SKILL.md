---
name: web-e2e-tests
description: Write or extend browser end-to-end tests (Playwright) for the web app — a real browser on the real Vite app, talking to the real API server and the real test database, following real user journeys (sign up with the emailed code, sign in, create an organization, …). Use whenever a screen, form, route guard or user journey in apps/web is added or changed, before calling a web feature done, and whenever the user asks for e2e, browser, UI-flow or Playwright tests, or says "make sure the flow works" — even if they don't say "e2e".
---

# Web end-to-end tests (Playwright)

A spec drives the real UI in Chromium. Playwright starts two servers: the **real API** (after rebuilding the test database: drop → migrate → seed) and the **web app** pointed at it. Nothing is mocked. Emails never leave the machine: the API's capture sender appends every OTP and invitation to `apps/web/.e2e/outbox.jsonl`, and specs read them from there. The database is emptied when the run ends.

```
apps/web/
├── playwright.config.ts          servers, ports (API 4100, web 5174), reporters
└── e2e/
    ├── specs/*.e2e.ts            one file per journey area (NOT *.spec.ts: vitest would run those)
    ├── fixtures.ts               `account` (fresh API-registered user), `signedInPage`
    └── support/
        ├── api.ts                registerAccount(), listOrganizations(), uniqueId(), TEST_PASSWORD
        ├── copy.ts               copy("<namespace>") → English UI strings from the contracts locales
        ├── outbox.ts             waitForOtp(identifier), waitForInvitationLink(identifier)
        └── env.ts                ports, URLs, paths
```

## What belongs here (and what doesn't)

End-to-end specs cover **user journeys that cross browser + API + database**: "a visitor signs up and ends up signed in", "an owner creates an organization", "an invitee accepts an invitation". Keep the suite small and slow-tolerant: one to three specs per feature.

Not here: every field-validation permutation (component/unit tests), API status codes and error mapping (`api-integration-tests`), pure logic (unit tests).

## Hard rules

1. **Drive the UI only for what the spec is about; arrange through the API.** Use the `account` and `signedInPage` fixtures or `registerAccount()`. The UI sign-up journey is covered once in `auth.e2e.ts`; do not repeat it as setup.
2. **Locators are role/label based and use the real copy:** `getByRole`, `getByLabel`, `getByText` with strings from `copy("<namespace>")` (`const t = copy("organization"); t("create.name.label")`). Never hard-code UI text, never use CSS classes, XPath or DOM position. If an element has no accessible name, give the component a proper label/role (preferred) or add a `data-testid`, and say so in your summary.
3. **No sleeps.** No `waitForTimeout`. Rely on auto-waiting and web-first assertions (`expect(locator).toBeVisible()`); poll with `expect.poll`; wait for a specific call with `page.waitForResponse`.
4. **Check side effects through the API** (helpers in `support/api.ts`, add one when missing), not the database and not by re-navigating the UI.
5. **Every test owns its data.** Fresh user from a fixture, unique values from `uniqueId()`, no order dependence, no shared state (`fullyParallel` is on).
6. **No network mocking** (`page.route`) except to simulate a failure the real stack cannot produce on demand (for example a 500), and then say so in a comment.
7. **OTPs and invitation links come from the outbox helpers**, never from the database or the server logs.
8. **Passing specs are requirements.** Never delete, skip or loosen a failing spec to get green. Selector drift → fix the locator from the component source. Behaviour drift → decide whether the app or the spec is wrong and say which in your summary.
9. Arabic/RTL: only for critical journeys, with `test.use({ locale: "ar" })` and Arabic copy; default specs run in English.

## Procedure

1. **Read the feature:** the route file (`apps/web/src/routes/...`), the feature components (labels come from `t("…")` keys; find the strings in `packages/contracts/src/<ns>/locales/en.json`), and the API calls it makes.
2. **List the journeys** before coding: the happy path, plus the one failure users actually hit (wrong password, expired code, duplicate code). Keep each as one `test`.
3. **Write `e2e/specs/<area>.e2e.ts`** from the template. Add helpers to `support/api.ts` rather than inlining `fetch` calls.
4. **Run it headed once** to see it work: `pnpm --filter @avuny/books-web e2e --headed e2e/specs/<area>.e2e.ts`. Fix locators against the real DOM; do not weaken assertions.
5. **Run the whole suite** (`pnpm --filter @avuny/books-web e2e`) and `pnpm --filter @avuny/books-web typecheck` (it covers `e2e/`).

First-time setup on a machine: `pnpm --filter @avuny/books-web exec playwright install chromium`, then `docker compose -f apps/server/docker-compose.test.yml up -d --wait`. Debug: `pnpm --filter @avuny/books-web e2e:ui`; keep the data with `KEEP_TEST_DB=1`; traces and screenshots of failures are in `playwright-report/` (`e2e:report`).

## Template

```ts
import { expect, test } from "../fixtures.ts"
import { listOrganizations, uniqueId } from "../support/api.ts"
import { copy } from "../support/copy.ts"

const t = copy("organization")

test.describe("organizations", () => {
  test("a signed-in user creates an organization", async ({ signedInPage: page, account, request }) => {
    const code = `e2e-${uniqueId()}`

    await page.goto("/organization/create")
    await page.getByLabel(t("create.name.label")).fill("Acme")
    await page.getByLabel(t("create.code.label")).fill(code)
    await page.locator("form").getByRole("button", { name: t("create.submitLabel") }).click()

    // Verify the effect through the API, not through wherever the app navigates next.
    await expect
      .poll(async () => (await listOrganizations(request, account)).map((o) => o.code))
      .toContain(code)
  })
})
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| webServer timed out | The API did not start: read its output above the error (database not running → `docker compose … up -d --wait`; invalid env → compare with `apps/server/.env.test.example`). |
| Browser console shows a CORS error | `CORS_ORIGINS` must equal the web URL; it is set in `playwright.config.ts`, do not change the web port without changing it there. |
| `Timed out … waiting for an OTP` | The API was not started by Playwright (a stale server without `MESSAGE_OUTBOX_FILE`), or the UI step before it failed. Stop stale servers on ports 4100/5174. |
| `strict mode violation` | The locator matches several elements. Scope it (`page.locator("form").getBy…`), use `{ exact: true }`, or fix the accessible name. |
| 429 from the API | Per-IP throttles are lifted by the config; if you see it, a spec is reusing one identifier. Use the fixtures. |

## Checklist before you finish

- [ ] The spec is `apps/web/e2e/specs/<area>.e2e.ts`, one `test` per journey, each owning its data.
- [ ] Locators use roles/labels and `copy()`; no hard-coded text, CSS, XPath, sleeps or network mocks.
- [ ] Side effects are verified through the API.
- [ ] Ran headed once, then the full suite and `typecheck`, all green.
- [ ] Your final message lists the journeys covered, any `data-testid` or component label you had to add, and anything you could not run.
