import { describe, expect, it, vi } from "vitest"
import type { MiddlewareHandler } from "hono"
import { createOpenAPIRouter } from "@avuny/hono"
import { fail, ok } from "@avuny/utils"
import { AccountingErrorCode as Code } from "@avuny/contracts"
import { balanceSheetRoute } from "../hono-routes/balance-sheet.route.js"
import { closePeriodRoute } from "../hono-routes/close-period.route.js"
import { createAccountRoute } from "../hono-routes/create-account.route.js"
import { createJournalEntryRoute } from "../hono-routes/create-journal-entry.route.js"
import { createPeriodRoute } from "../hono-routes/create-period.route.js"
import { deleteAccountRoute } from "../hono-routes/delete-account.route.js"
import { deleteJournalEntryRoute } from "../hono-routes/delete-journal-entry.route.js"
import { generalLedgerRoute } from "../hono-routes/general-ledger.route.js"
import { getAccountRoute } from "../hono-routes/get-account.route.js"
import { getJournalEntryRoute } from "../hono-routes/get-journal-entry.route.js"
import { listAccountMappingsRoute } from "../hono-routes/list-account-mappings.route.js"
import { listAccountsRoute } from "../hono-routes/list-accounts.route.js"
import { listJournalEntriesRoute } from "../hono-routes/list-journal-entries.route.js"
import { listPeriodsRoute } from "../hono-routes/list-periods.route.js"
import { postJournalEntryRoute } from "../hono-routes/post-journal-entry.route.js"
import { postOpeningBalancesRoute } from "../hono-routes/post-opening-balances.route.js"
import { profitAndLossRoute } from "../hono-routes/profit-and-loss.route.js"
import { reverseJournalEntryRoute } from "../hono-routes/reverse-journal-entry.route.js"
import { trialBalanceRoute } from "../hono-routes/trial-balance.route.js"
import { updateAccountMappingRoute } from "../hono-routes/update-account-mapping.route.js"
import { updateAccountRoute } from "../hono-routes/update-account.route.js"
import { updateJournalEntryRoute } from "../hono-routes/update-journal-entry.route.js"

describe("accounting routes", () => {
  const userId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
  const orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"
  const accountId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03"
  const entryId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04"
  const periodId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05"
  const otherAccountId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06"
  const iso = new Date().toISOString()

  const requireAuth: MiddlewareHandler = async (c, next) => {
    c.set("user", { id: userId })
    await next()
  }
  const allow = () => (async (_c: any, next: any) => next()) as MiddlewareHandler
  /** A permission middleware that records what the route asked for, and lets the request through. */
  const recordPermission = (asked: string[]) => (permission: string) =>
    (async (_c: any, next: any) => {
      asked.push(permission)
      await next()
    }) as MiddlewareHandler
  const deny = () =>
    (async (c: any) => c.json({ success: false, error: "ROLE_PERMISSION_DENIED", msg: "no" }, 403)) as MiddlewareHandler
  const mount = (route: ReturnType<typeof createOpenAPIRouter>) => {
    const app = createOpenAPIRouter()
    app.route("/", route)
    return app
  }
  const json = (body: unknown) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const accountDto = {
    id: accountId, orgId, code: "1110", name: "Cash on Hand", description: null, type: "ASSET",
    normalBalance: "DEBIT", parentId: null, systemKey: "CASH", isSystem: true, isActive: true,
    allowPosting: true, createdAt: iso, updatedAt: iso,
  }
  const entryDto = {
    id: entryId, orgId, entryNumber: "JE-000001", date: "2026-11-10", description: null, status: "POSTED",
    currency: "EGP", sourceType: null, sourceId: null, sourceRef: null, reversalOfId: null, reversedById: null,
    totalDebit: "100", totalCredit: "100", createdBy: userId, postedAt: iso, postedBy: userId,
    createdAt: iso, updatedAt: iso,
    lines: [
      { id: accountId, lineNo: 1, accountId, accountCode: "1110", accountName: "Cash", description: null, debit: "100", credit: "0" },
      { id: entryId, lineNo: 2, accountId: otherAccountId, accountCode: "3100", accountName: "Capital", description: null, debit: "0", credit: "100" },
    ],
  }
  const balancedLines = [
    { accountId, debit: "100", credit: "0" },
    { accountId: otherAccountId, debit: "0", credit: "100" },
  ]
  const periodDto = { id: periodId, orgId, name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30", status: "OPEN", closedAt: null, closedBy: null, createdAt: iso, updatedAt: iso }

  describe("accounts", () => {
    it("creates an account (201) and passes the caller, organization and body to the service", async () => {
      const service: any = { createAccount: vi.fn().mockResolvedValue(ok({ data: accountDto, msg: "created" })) }
      const asked: string[] = []
      const app = mount(createAccountRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))

      const res = await app.request(`/organizations/${orgId}/accounts`, json({ code: "1190", name: "Petty Cash", type: "ASSET" }))

      expect(res.status).toBe(201)
      expect(service.createAccount).toHaveBeenCalledWith(userId, orgId, expect.objectContaining({ code: "1190", allowPosting: true }))
      expect(asked).toEqual(["create:accounting"])
    })

    it.each([
      ["a missing name", { code: "1190", type: "ASSET" }],
      ["an unknown type", { code: "1190", name: "X", type: "WIZARD" }],
      ["an empty code", { code: "", name: "X", type: "ASSET" }],
    ])("rejects %s with 422 and never calls the service", async (_label, body) => {
      const service: any = { createAccount: vi.fn() }
      const app = mount(createAccountRoute({ service, requireAuth, requirePermission: allow }))
      const res = await app.request(`/organizations/${orgId}/accounts`, json(body))
      expect(res.status).toBe(422)
      expect(service.createAccount).not.toHaveBeenCalled()
    })

    it("maps a taken code to 409 and a bad parent to 422", async () => {
      const taken: any = { createAccount: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNT_CODE_TAKEN, msg: "taken" })) }
      const body = json({ code: "1190", name: "Petty Cash", type: "ASSET" })
      expect((await mount(createAccountRoute({ service: taken, requireAuth, requirePermission: allow })).request(`/organizations/${orgId}/accounts`, body)).status).toBe(409)

      const parent: any = { createAccount: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNT_PARENT_INVALID, msg: "bad parent" })) }
      expect((await mount(createAccountRoute({ service: parent, requireAuth, requirePermission: allow })).request(`/organizations/${orgId}/accounts`, body)).status).toBe(422)
    })

    it("answers 403 when the permission middleware denies, without touching the service", async () => {
      const service: any = { createAccount: vi.fn() }
      const app = mount(createAccountRoute({ service, requireAuth, requirePermission: deny as any }))
      const res = await app.request(`/organizations/${orgId}/accounts`, json({ code: "1190", name: "Petty Cash", type: "ASSET" }))
      expect(res.status).toBe(403)
      expect(service.createAccount).not.toHaveBeenCalled()
    })

    it("lists accounts with defaults for paging and requires read permission", async () => {
      const service: any = { listAccounts: vi.fn().mockResolvedValue(ok({ data: { items: [accountDto], page: 1, pageSize: 50, total: 1 }, msg: "ok" })) }
      const asked: string[] = []
      const app = mount(listAccountsRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))

      const res = await app.request(`/organizations/${orgId}/accounts?type=ASSET&postableOnly=true`)

      expect(res.status).toBe(200)
      expect(service.listAccounts).toHaveBeenCalledWith(orgId, expect.objectContaining({ page: 1, type: "ASSET", postableOnly: true }))
      expect(asked).toEqual(["read:accounting"])
    })

    it("rejects an invalid list filter with 422", async () => {
      const service: any = { listAccounts: vi.fn() }
      const app = mount(listAccountsRoute({ service, requireAuth, requirePermission: allow }))
      expect((await app.request(`/organizations/${orgId}/accounts?type=WIZARD`)).status).toBe(422)
      expect((await app.request(`/organizations/${orgId}/accounts?page=0`)).status).toBe(422)
    })

    it("gets one account, 404 when unknown, 422 for a malformed id", async () => {
      const found: any = { getAccount: vi.fn().mockResolvedValue(ok({ data: accountDto, msg: "ok" })) }
      expect((await mount(getAccountRoute({ service: found, requireAuth, requirePermission: allow })).request(`/organizations/${orgId}/accounts/${accountId}`)).status).toBe(200)
      expect(found.getAccount).toHaveBeenCalledWith(orgId, accountId)

      const missing: any = { getAccount: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNT_NOT_FOUND, msg: "nope" })) }
      expect((await mount(getAccountRoute({ service: missing, requireAuth, requirePermission: allow })).request(`/organizations/${orgId}/accounts/${accountId}`)).status).toBe(404)
      expect((await mount(getAccountRoute({ service: found, requireAuth, requirePermission: allow })).request(`/organizations/${orgId}/accounts/not-a-uuid`)).status).toBe(422)
    })

    it("updates with PATCH, maps system and in-use conflicts to 409, rejects an empty patch", async () => {
      const service: any = { updateAccount: vi.fn().mockResolvedValue(ok({ data: accountDto, msg: "ok" })) }
      const asked: string[] = []
      const app = mount(updateAccountRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))
      const patch = (body: unknown) => app.request(`/organizations/${orgId}/accounts/${accountId}`, { ...json(body), method: "PATCH" })

      expect((await patch({ name: "Cash Box" })).status).toBe(200)
      expect(service.updateAccount).toHaveBeenCalledWith(userId, orgId, accountId, { name: "Cash Box" })
      expect(asked).toEqual(["update:accounting"])
      expect((await patch({})).status).toBe(422)

      for (const error of [Code.ACCOUNT_SYSTEM_READONLY, Code.ACCOUNT_IN_USE, Code.ACCOUNT_CODE_TAKEN]) {
        const failing: any = { updateAccount: vi.fn().mockResolvedValue(fail({ error, msg: "x" })) }
        const res = await mount(updateAccountRoute({ service: failing, requireAuth, requirePermission: allow })).request(
          `/organizations/${orgId}/accounts/${accountId}`,
          { ...json({ name: "X" }), method: "PATCH" }
        )
        expect(res.status).toBe(409)
      }
    })

    it("deletes with DELETE permission and maps a used account to 409", async () => {
      const service: any = { deleteAccount: vi.fn().mockResolvedValue(ok({ data: { id: accountId }, msg: "deleted" })) }
      const asked: string[] = []
      const ok200 = await mount(deleteAccountRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any })).request(
        `/organizations/${orgId}/accounts/${accountId}`,
        { method: "DELETE" }
      )
      expect(ok200.status).toBe(200)
      expect(asked).toEqual(["delete:accounting"])

      const used: any = { deleteAccount: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNT_IN_USE, msg: "used" })) }
      const res = await mount(deleteAccountRoute({ service: used, requireAuth, requirePermission: allow })).request(
        `/organizations/${orgId}/accounts/${accountId}`,
        { method: "DELETE" }
      )
      expect(res.status).toBe(409)
    })
  })

  describe("account mappings", () => {
    it("lists mappings", async () => {
      const service: any = { listMappings: vi.fn().mockResolvedValue(ok({ data: { items: [] }, msg: "ok" })) }
      const res = await mount(listAccountMappingsRoute({ service, requireAuth, requirePermission: allow })).request(`/organizations/${orgId}/account-mappings`)
      expect(res.status).toBe(200)
      expect(service.listMappings).toHaveBeenCalledWith(orgId)
    })

    it("updates one role with PUT, rejects an unknown role key with 422 and an invalid target with 422", async () => {
      const mappingDto = { key: "CASH", accountId, accountCode: "1110", accountName: "Cash on Hand", updatedAt: iso }
      const service: any = { updateMapping: vi.fn().mockResolvedValue(ok({ data: mappingDto, msg: "ok" })) }
      const asked: string[] = []
      const app = mount(updateAccountMappingRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))
      const put = (key: string, body: unknown) => app.request(`/organizations/${orgId}/account-mappings/${key}`, { ...json(body), method: "PUT" })

      expect((await put("CASH", { accountId })).status).toBe(200)
      expect(service.updateMapping).toHaveBeenCalledWith(userId, orgId, "CASH", { accountId })
      expect(asked).toEqual(["update:accounting"])
      expect((await put("NOT_A_ROLE", { accountId })).status).toBe(422)
      expect((await put("CASH", { accountId: "nope" })).status).toBe(422)

      const invalid: any = { updateMapping: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNT_MAPPING_INVALID, msg: "wrong type" })) }
      const res = await mount(updateAccountMappingRoute({ service: invalid, requireAuth, requirePermission: allow })).request(
        `/organizations/${orgId}/account-mappings/CASH`,
        { ...json({ accountId }), method: "PUT" }
      )
      expect(res.status).toBe(422)
    })
  })

  describe("journal entries", () => {
    const path = `/organizations/${orgId}/journal-entries`

    it("creates a draft (201) and requires create permission", async () => {
      const service: any = { createJournalEntry: vi.fn().mockResolvedValue(ok({ data: { ...entryDto, status: "DRAFT" }, msg: "ok" })) }
      const asked: string[] = []
      const app = mount(createJournalEntryRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))

      const res = await app.request(path, json({ date: "2026-11-10", lines: balancedLines }))

      expect(res.status).toBe(201)
      expect(service.createJournalEntry).toHaveBeenCalledWith(userId, orgId, expect.objectContaining({ date: "2026-11-10" }))
      expect(asked).toEqual(["create:accounting"])
    })

    it.each([
      ["a single line", { date: "2026-11-10", lines: [balancedLines[0]] }],
      ["a malformed date", { date: "10/11/2026", lines: balancedLines }],
      ["a fractional amount", { date: "2026-11-10", lines: [{ accountId, debit: "1.5", credit: "0" }, balancedLines[1]] }],
      ["a negative amount", { date: "2026-11-10", lines: [{ accountId, debit: "-1", credit: "0" }, balancedLines[1]] }],
      ["no lines", { date: "2026-11-10" }],
    ])("rejects %s with 422 and never calls the service", async (_label, body) => {
      const service: any = { createJournalEntry: vi.fn() }
      const app = mount(createJournalEntryRoute({ service, requireAuth, requirePermission: allow }))
      expect((await app.request(path, json(body))).status).toBe(422)
      expect(service.createJournalEntry).not.toHaveBeenCalled()
    })

    it("maps an unbalanced entry to 422", async () => {
      const service: any = { createJournalEntry: vi.fn().mockResolvedValue(fail({ error: Code.JOURNAL_ENTRY_UNBALANCED, msg: "off by 1" })) }
      const app = mount(createJournalEntryRoute({ service, requireAuth, requirePermission: allow }))
      expect((await app.request(path, json({ date: "2026-11-10", lines: balancedLines }))).status).toBe(422)
    })

    it("lists, filters and gets entries", async () => {
      const list: any = { listJournalEntries: vi.fn().mockResolvedValue(ok({ data: { items: [], page: 1, pageSize: 50, total: 0 }, msg: "ok" })) }
      const res = await mount(listJournalEntriesRoute({ service: list, requireAuth, requirePermission: allow })).request(`${path}?status=DRAFT&from=2026-11-01`)
      expect(res.status).toBe(200)
      expect(list.listJournalEntries).toHaveBeenCalledWith(orgId, expect.objectContaining({ status: "DRAFT", from: "2026-11-01" }))
      expect((await mount(listJournalEntriesRoute({ service: list, requireAuth, requirePermission: allow })).request(`${path}?status=WHATEVER`)).status).toBe(422)

      const get: any = { getJournalEntry: vi.fn().mockResolvedValue(fail({ error: Code.JOURNAL_ENTRY_NOT_FOUND, msg: "nope" })) }
      expect((await mount(getJournalEntryRoute({ service: get, requireAuth, requirePermission: allow })).request(`${path}/${entryId}`)).status).toBe(404)
    })

    it("updates a draft and answers 409 when the entry is already posted", async () => {
      const service: any = { updateJournalEntry: vi.fn().mockResolvedValue(fail({ error: Code.JOURNAL_ENTRY_ALREADY_POSTED, msg: "posted" })) }
      const app = mount(updateJournalEntryRoute({ service, requireAuth, requirePermission: allow }))
      const res = await app.request(`${path}/${entryId}`, { ...json({ description: "x" }), method: "PATCH" })
      expect(res.status).toBe(409)
      expect((await app.request(`${path}/${entryId}`, { ...json({}), method: "PATCH" })).status).toBe(422)
    })

    it("deletes a draft with delete permission", async () => {
      const service: any = { deleteJournalEntry: vi.fn().mockResolvedValue(ok({ data: { id: entryId }, msg: "ok" })) }
      const asked: string[] = []
      const app = mount(deleteJournalEntryRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))
      expect((await app.request(`${path}/${entryId}`, { method: "DELETE" })).status).toBe(200)
      expect(asked).toEqual(["delete:accounting"])
    })

    it("posts a draft; a closed period or a repeated post is 409", async () => {
      const service: any = { postJournalEntry: vi.fn().mockResolvedValue(ok({ data: entryDto, msg: "ok" })) }
      const asked: string[] = []
      expect((await mount(postJournalEntryRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any })).request(`${path}/${entryId}/post`, { method: "POST" })).status).toBe(200)
      expect(service.postJournalEntry).toHaveBeenCalledWith(userId, orgId, entryId)
      expect(asked).toEqual(["create:accounting"])

      for (const error of [Code.JOURNAL_ENTRY_PERIOD_CLOSED, Code.JOURNAL_ENTRY_ALREADY_POSTED]) {
        const failing: any = { postJournalEntry: vi.fn().mockResolvedValue(fail({ error, msg: "x" })) }
        expect((await mount(postJournalEntryRoute({ service: failing, requireAuth, requirePermission: allow })).request(`${path}/${entryId}/post`, { method: "POST" })).status).toBe(409)
      }
    })

    it("reverses with update permission (201) and maps reversal conflicts to 409", async () => {
      const service: any = { reverseJournalEntry: vi.fn().mockResolvedValue(ok({ data: entryDto, msg: "ok" })) }
      const asked: string[] = []
      const app = mount(reverseJournalEntryRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))

      expect((await app.request(`${path}/${entryId}/reverse`, json({ date: "2026-11-12" }))).status).toBe(201)
      expect(service.reverseJournalEntry).toHaveBeenCalledWith(userId, orgId, entryId, { date: "2026-11-12" })
      expect(asked).toEqual(["update:accounting"])
      expect((await app.request(`${path}/${entryId}/reverse`, json({ date: "tomorrow" }))).status).toBe(422)

      for (const error of [Code.JOURNAL_ENTRY_ALREADY_REVERSED, Code.JOURNAL_ENTRY_NOT_POSTED, Code.JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL]) {
        const failing: any = { reverseJournalEntry: vi.fn().mockResolvedValue(fail({ error, msg: "x" })) }
        expect((await mount(reverseJournalEntryRoute({ service: failing, requireAuth, requirePermission: allow })).request(`${path}/${entryId}/reverse`, json({}))).status).toBe(409)
      }
    })
  })

  describe("opening balances", () => {
    it("posts opening balances (201) and validates the body", async () => {
      const service: any = { postOpeningBalances: vi.fn().mockResolvedValue(ok({ data: entryDto, msg: "ok" })) }
      const app = mount(postOpeningBalancesRoute({ service, requireAuth, requirePermission: allow }))
      const path = `/organizations/${orgId}/opening-balances`

      expect((await app.request(path, json({ date: "2026-11-01", lines: [{ accountId, debit: "100", credit: "0" }] }))).status).toBe(201)
      expect((await app.request(path, json({ date: "2026-11-01", lines: [] }))).status).toBe(422)
      expect((await app.request(path, json({ lines: [{ accountId, debit: "1", credit: "0" }] }))).status).toBe(422)
    })

    it("maps an invalid opening line to 422 and a closed period to 409", async () => {
      const path = `/organizations/${orgId}/opening-balances`
      const body = json({ date: "2026-11-01", lines: [{ accountId, debit: "100", credit: "0" }] })
      const invalid: any = { postOpeningBalances: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNTING_OPENING_BALANCE_INVALID, msg: "x" })) }
      expect((await mount(postOpeningBalancesRoute({ service: invalid, requireAuth, requirePermission: allow })).request(path, body)).status).toBe(422)
      const closed: any = { postOpeningBalances: vi.fn().mockResolvedValue(fail({ error: Code.JOURNAL_ENTRY_PERIOD_CLOSED, msg: "x" })) }
      expect((await mount(postOpeningBalancesRoute({ service: closed, requireAuth, requirePermission: allow })).request(path, body)).status).toBe(409)
    })
  })

  describe("periods", () => {
    const path = `/organizations/${orgId}/periods`

    it("lists and creates periods", async () => {
      const list: any = { listPeriods: vi.fn().mockResolvedValue(ok({ data: { items: [periodDto] }, msg: "ok" })) }
      expect((await mount(listPeriodsRoute({ service: list, requireAuth, requirePermission: allow })).request(path)).status).toBe(200)

      const create: any = { createPeriod: vi.fn().mockResolvedValue(ok({ data: periodDto, msg: "ok" })) }
      const app = mount(createPeriodRoute({ service: create, requireAuth, requirePermission: allow }))
      expect((await app.request(path, json({ name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))).status).toBe(201)
      expect((await app.request(path, json({ name: "Backwards", startDate: "2026-11-30", endDate: "2026-11-01" }))).status).toBe(422)
    })

    it("maps an overlapping period to 409", async () => {
      const service: any = { createPeriod: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNTING_PERIOD_OVERLAP, msg: "overlap" })) }
      const app = mount(createPeriodRoute({ service, requireAuth, requirePermission: allow }))
      expect((await app.request(path, json({ name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))).status).toBe(409)
    })

    it("closes a period; unknown is 404 and already closed is 409", async () => {
      const closed = { ...periodDto, status: "CLOSED" }
      const service: any = { closePeriod: vi.fn().mockResolvedValue(ok({ data: closed, msg: "ok" })) }
      expect((await mount(closePeriodRoute({ service, requireAuth, requirePermission: allow })).request(`${path}/${periodId}/close`, { method: "POST" })).status).toBe(200)

      const missing: any = { closePeriod: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNTING_PERIOD_NOT_FOUND, msg: "x" })) }
      expect((await mount(closePeriodRoute({ service: missing, requireAuth, requirePermission: allow })).request(`${path}/${periodId}/close`, { method: "POST" })).status).toBe(404)
      const again: any = { closePeriod: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNTING_PERIOD_ALREADY_CLOSED, msg: "x" })) }
      expect((await mount(closePeriodRoute({ service: again, requireAuth, requirePermission: allow })).request(`${path}/${periodId}/close`, { method: "POST" })).status).toBe(409)
    })
  })

  describe("reports", () => {
    const base = `/organizations/${orgId}/reports`

    it("validates the general ledger query and maps its errors", async () => {
      const service: any = {
        getGeneralLedger: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNT_NOT_FOUND, msg: "nope" })),
      }
      const app = mount(generalLedgerRoute({ service, requireAuth, requirePermission: allow }))
      expect((await app.request(`${base}/general-ledger`)).status).toBe(422) // accountId is required
      expect((await app.request(`${base}/general-ledger?accountId=${accountId}&from=2026-12-01&to=2026-11-01`)).status).toBe(422)
      expect((await app.request(`${base}/general-ledger?accountId=${accountId}`)).status).toBe(404)
      expect(service.getGeneralLedger).toHaveBeenCalledWith(orgId, expect.objectContaining({ accountId, page: 1 }))
    })

    it("serves the trial balance and balance sheet with optional dates", async () => {
      const service: any = {
        getTrialBalance: vi.fn().mockResolvedValue(
          ok({ data: { asOf: "2026-11-30", currency: "EGP", rows: [], groups: [], totalDebit: "0", totalCredit: "0", isBalanced: true }, msg: "ok" })
        ),
        getBalanceSheet: vi.fn(),
      }
      const asked: string[] = []
      const app = mount(trialBalanceRoute({ service, requireAuth, requirePermission: recordPermission(asked) as any }))
      expect((await app.request(`${base}/trial-balance?asOf=2026-11-30&includeZero=true`)).status).toBe(200)
      expect(service.getTrialBalance).toHaveBeenCalledWith(orgId, { asOf: "2026-11-30", includeZero: true })
      expect(asked).toEqual(["read:accounting"])
      expect((await app.request(`${base}/trial-balance?asOf=yesterday`)).status).toBe(422)

      const bs = mount(balanceSheetRoute({ service, requireAuth, requirePermission: allow }))
      expect((await bs.request(`${base}/balance-sheet?asOf=nonsense`)).status).toBe(422)
    })

    it("requires both ends of a profit and loss range and maps a backwards range to 422", async () => {
      const service: any = { getProfitAndLoss: vi.fn().mockResolvedValue(fail({ error: Code.ACCOUNTING_INVALID_DATE_RANGE, msg: "x" })) }
      const app = mount(profitAndLossRoute({ service, requireAuth, requirePermission: allow }))
      expect((await app.request(`${base}/profit-and-loss?from=2026-11-01`)).status).toBe(422)
      expect((await app.request(`${base}/profit-and-loss?from=2026-11-01&to=2026-11-30`)).status).toBe(422)
      expect(service.getProfitAndLoss).toHaveBeenCalledTimes(1)
    })

    it("denies every route without permission", async () => {
      const service: any = new Proxy({}, { get: () => vi.fn() })
      const routes = [
        [generalLedgerRoute, `${base}/general-ledger?accountId=${accountId}`],
        [trialBalanceRoute, `${base}/trial-balance`],
        [balanceSheetRoute, `${base}/balance-sheet`],
        [profitAndLossRoute, `${base}/profit-and-loss?from=2026-11-01&to=2026-11-30`],
      ] as const
      for (const [route, url] of routes) {
        const res = await mount(route({ service, requireAuth, requirePermission: deny as any })).request(url)
        expect(res.status).toBe(403)
      }
    })
  })
})
