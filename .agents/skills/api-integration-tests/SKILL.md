---
name: api-integration-tests
description: Write or extend integration tests for a backend module's HTTP routes that run the REAL app against the REAL test database through real user flows (sign-up → organization → module operations) with no mocks of our own code. Use whenever a module is added or changed, an endpoint, permission, error code or constraint is added or changed, a bug is fixed in a route/service/repository, or the user mentions route tests, integration tests, API tests, "real flow" tests or "test this module" — even if they don't say "integration".
---

# API integration tests (real app, real database)

Each module gets **one file**, `apps/server/src/api/modules/<module>/<module>.routes.int.test.ts`, that drives the real Hono app (`app.request`) with a real access token, real permission checks, real services and repositories, and a real Postgres test database.

Reference implementation: `apps/server/src/api/modules/organization/organization.routes.int.test.ts`. Harness API: `references/harness-api.md`.

## What these tests prove (and what they don't)

They prove the **wiring and the real infrastructure**: route → auth → permission → service → repository → Postgres, tenant isolation, database constraints turning into the right error code, status codes and response shapes.

They do **not** replace service unit tests (`<module>.service.spec.ts`, fakes, no DB). Branches, calculations and state-machine details belong there. Here, cover every **route** and every **error code that can come back over HTTP**, not every branch. Risk-based, not coverage-driven: a few flows that would hurt if broken beat many shallow ones.

## Hard rules

1. **No mocks of our own code.** No `vi.mock` of services, repositories, the permission checker, the database or the clock. The only substitutes are adapters for external providers, chosen by environment (`MESSAGE_SENDER_MODE=capture` for email/WhatsApp). A new third-party boundary gets an in-memory adapter selected by env, never a mock inside a test.
2. **Arrange through the public API** with the factories (`createUser`, `createOrganization`, …). Insert rows directly only for a state no endpoint can produce, through a helper in `test-support`, with a comment saying why.
3. **Every test builds its own tenant** (new user + new organization). Never assume empty tables, global counts, or data from another test. Never `DELETE`/`TRUNCATE` in a test: global setup rebuilds the database and global teardown empties it.
4. **Assert the public contract:** HTTP status, the envelope (`success`), the error `code` (use the `*ErrorCode` constants from `@avuny/contracts`), DTO fields. Never assert message text. No `any`, no `as unknown as`.
5. **Passing tests are requirements.** Never delete, skip or loosen a failing test to get green. A failure is either a bug (fix the code) or a wrong expectation (fix the test and say why in your summary). Fixing a bug starts with a failing regression test.
6. **Deterministic:** no `sleep`, no assumptions about list order beyond what the endpoint documents, unique values come from the factories (`uniqueId()`), never fixed strings that can collide across parallel files.

## Procedure

1. **Read before writing.** The module's `hono-routes/*.route.ts` (paths, statuses, `errorMap`, `jsonError` lists), `<module>.service.ts` (permission keys, rules, transactions), `<module>.errors.ts`, the contracts schemas and `*ErrorCode`, `SPEC.md` if the module has one, and `packages/contracts/src/modules/registry.ts` for the permission keys.
2. **Write the scenario table first** (in your reply, not in the file). One row per scenario, from this required set:

   | Area | Scenario | Expect |
   |---|---|---|
   | Auth | every route without a token | 401 |
   | Authorization | a signed-in user who is not in the organization calls every read and write route | 403 (or 404 if the service hides existence) |
   | Lifecycle | one flow: create → get → list (finds it) → options → update → delete → get | 201 / 200 / 200 / 200 / 200 / 200 / 404 |
   | Aggregate | parent with child lines: create, replace lines, children belong to the parent and organization; a child id from another parent or organization is rejected | rules from the service |
   | Conflicts | every error code in the module's `errorsHttpMap` that is reachable over HTTP, triggered for real: unique index (duplicate), foreign key (delete something referenced), state rule (edit/delete a posted or non-draft record) | status + code from the map |
   | Validation | malformed body, boundary values from the contract schema | 422 `VALIDATION_ERROR` with `errors` |
   | Listing | pagination (`page`, `pageSize`, `total`), search, each filter; cursor pagination for options (`nextCursor`) | contract shape |
   | Isolation | data created in organization A never appears in B's list, options or get | see Authorization |
   | Concurrency | only if the service locks (`forUpdate`): two simultaneous requests via `Promise.all` | exactly one wins |

   Skip a row only when the module has no such route or rule, and say so.
3. **Create `<module>.routes.int.test.ts`** from the template below. Keep one `describe` per area. Arrange inside each `it` (or a small `arrange()` helper in the file), not in shared mutable `beforeAll` state.
4. **Run it:** `pnpm --filter @avuny/books-server test:int <module>` until green, then the whole `pnpm --filter @avuny/books-server test:int`, then `pnpm --filter @avuny/books-server typecheck`.
5. **Run the checklist** at the bottom.

If `test:int` fails at start-up, read `references/harness-api.md` § Troubleshooting. Never point the suite at any database other than the test database; the harness refuses anything whose name does not contain `test` or `e2e`.

## Template

```ts
import { beforeAll, describe, expect, it } from "vitest"
import type { ItemDto, ItemOffsetListResponse } from "@avuny/contracts"
import {
  createOrganization,
  createTestApp,
  createUser,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

describe("item routes (integration)", () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })

  describe("authentication", () => {
    it("rejects every route without a token", async () => {
      expectFailure(await t.anonymous.get("/organizations/x/items"), 401)
    })
  })

  describe("lifecycle", () => {
    it("creates, reads, lists, updates and deletes", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/organizations/${org.id}/items`

      const created = expectOk(
        await owner.api.post<ItemDto>(base, { json: { name: "Widget" /* …valid body… */ } }),
        201
      )
      expect(expectOk(await owner.api.get<ItemDto>(`${base}/${created.id}`), 200)).toMatchObject({
        id: created.id,
        name: "Widget",
      })
      const list = expectOk(await owner.api.get<ItemOffsetListResponse>(base, { query: { page: 1, pageSize: 20 } }))
      expect(list.items.map((i) => i.id)).toContain(created.id)

      expectOk(await owner.api.patch<ItemDto>(`${base}/${created.id}`, { json: { name: "Gadget" } }), 200)
      expectOk(await owner.api.delete(`${base}/${created.id}`), 200)
      expectFailure(await owner.api.get(`${base}/${created.id}`), 404, "ITEM_NOT_FOUND")
    })
  })

  describe("tenant isolation", () => {
    it("keeps another organization's data out of reach", async () => {
      const { org } = await createUserWithOrganization(t.app)
      const outsider = await createUser(t.app)
      await createOrganization(outsider) // outsider owns their own org, not this one
      expectFailure(await outsider.api.get(`/organizations/${org.id}/items`), 403)
    })
  })
})
```

Adapt paths, DTO types and error codes to the real module; the item names above are illustrative. Take paths from the route files, not from memory.

## Members, roles and the "who may do what" matrix

An outsider (not in the organization) proves the organization-scoped permission check. When a module's rules depend on a member's role or on record-scoped grants, arrange a real member through the invitation flow: the owner creates an invitation, the test reads the link with `getCaptureOutbox().lastInvitation(email)`, and the invitee accepts it. If the harness has no `createMember()` helper yet, add it to `test-support/factories.ts` following `createUser`, then reuse it everywhere. Check `organization-invitation` routes for the real paths and bodies first.

## Checklist before you finish

- [ ] The file is `<module>.routes.int.test.ts` at the module root, imports only from `test-support`, `@avuny/contracts`, `vitest`.
- [ ] Every route of the module is hit at least once; every reachable error code is triggered.
- [ ] 401 and cross-organization 403/404 are covered for reads and writes.
- [ ] No `vi.mock`, no `any`, no `sleep`/`setTimeout`, no shared mutable state between tests, no fixed unique values.
- [ ] Assertions use status + `code` + DTO fields, not message text.
- [ ] `test:int` and `typecheck` pass; the unit tests (`pnpm --filter @avuny/books-server test`) still pass.
- [ ] Your final message lists the scenario table with what is covered, what was skipped and why, and any production bug the tests exposed.
