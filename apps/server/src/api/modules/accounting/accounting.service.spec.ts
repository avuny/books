import { describe, expect, it } from "vitest"
import {
  ACCOUNT_MAPPING_KEYS,
  ActivityLogAction,
  DEFAULT_ACCOUNT_MAPPINGS,
  DEFAULT_ACCOUNTS,
  formatJournalEntryNumber,
} from "@avuny/contracts"
import {
  ACTOR,
  ORG,
  OTHER_ORG,
  errorOf,
  line,
  postedEntry,
  setup,
  thrown,
  unwrap,
} from "./__tests__/helpers.js"

const account = (o: Record<string, unknown> = {}) => ({
  code: "1190",
  name: "Petty Cash",
  type: "ASSET" as const,
  allowPosting: true,
  ...o,
})

describe("initializeChartOfAccounts", () => {
  it("creates the whole default chart and its mappings", async () => {
    const t = setup()
    const result = unwrap(await t.initChart())

    expect(result).toEqual({
      accountsCreated: DEFAULT_ACCOUNTS.length,
      mappingsCreated: DEFAULT_ACCOUNT_MAPPINGS.length,
    })
    const accounts = await t.repository.listAllAccounts(ORG)
    expect(accounts).toHaveLength(DEFAULT_ACCOUNTS.length)
    expect(accounts.every((a) => a.systemKey !== null)).toBe(true)
    expect(await t.repository.listMappings(ORG)).toHaveLength(ACCOUNT_MAPPING_KEYS.length)
  })

  it("links every child to its parent", async () => {
    const t = setup()
    await t.initChart()
    const cash = (await t.repository.listAllAccounts(ORG)).find((a) => a.systemKey === "CASH")
    expect(cash?.parentId).toBe(await t.account("CURRENT_ASSETS"))
  })

  it("is idempotent: a second run creates nothing", async () => {
    const t = setup()
    await t.initChart()
    expect(unwrap(await t.initChart())).toEqual({ accountsCreated: 0, mappingsCreated: 0 })
    expect(await t.repository.listAllAccounts(ORG)).toHaveLength(DEFAULT_ACCOUNTS.length)
  })

  it("keeps a renamed account and a re-pointed mapping on a re-run", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    unwrap(await t.service.updateAccount(ACTOR, ORG, cash, { name: "Main Cash Box" }))
    const bank = await t.account("BANK")
    unwrap(await t.service.updateMapping(ACTOR, ORG, "CASH", { accountId: bank }))

    await t.initChart()

    expect((await t.repository.findAccountById(ORG, cash))?.name).toBe("Main Cash Box")
    expect(await t.mapped("CASH")).toBe(bank)
  })

  it("fills in only what is missing and adopts an existing default account", async () => {
    const t = setup()
    // An organization that already has one default account (found by its system key), renamed.
    const existing = await t.repository.insertAccount({
      orgId: ORG,
      code: "1000",
      name: "My Assets",
      type: "ASSET",
      normalBalance: "DEBIT",
      systemKey: "ASSETS",
      allowPosting: false,
    })
    expect(existing.ok).toBe(true)

    const result = unwrap(await t.initChart())

    expect(result.accountsCreated).toBe(DEFAULT_ACCOUNTS.length - 1)
    const accounts = await t.repository.listAllAccounts(ORG)
    expect(accounts.filter((a) => a.systemKey === "ASSETS")).toHaveLength(1)
    expect(accounts.find((a) => a.systemKey === "ASSETS")?.name).toBe("My Assets")
    const currentAssets = accounts.find((a) => a.systemKey === "CURRENT_ASSETS")
    expect(currentAssets?.parentId).toBe(accounts.find((a) => a.systemKey === "ASSETS")?.id)
  })

  it("rejects a clash with a custom account before writing anything", async () => {
    const t = setup()
    unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "1110", name: "My own cash" })))
    const before = (await t.repository.listAllAccounts(ORG)).length

    const result = await t.initChart()

    expect(errorOf(result)).toBe("ACCOUNT_CODE_TAKEN")
    expect((await t.repository.listAllAccounts(ORG)).length).toBe(before)
    expect(await t.repository.listMappings(ORG)).toHaveLength(0)
  })

  it("never touches another organization", async () => {
    const t = setup()
    await t.initChart(ORG)
    expect(await t.repository.listAllAccounts(OTHER_ORG)).toHaveLength(0)
    expect(await t.repository.listMappings(OTHER_ORG)).toHaveLength(0)
  })
})

describe("accounts", () => {
  it("creates an account, trims the code and defaults the normal balance to the type", async () => {
    const t = setup()
    await t.initChart()

    const created = unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: " 1190 " })))

    expect(created).toMatchObject({
      code: "1190",
      type: "ASSET",
      normalBalance: "DEBIT",
      isSystem: false,
      isActive: true,
    })
    expect(t.events.at(-1)).toMatchObject({
      action: ActivityLogAction.ACCOUNTING_ACCOUNT_CREATED,
      actorId: ACTOR,
      orgId: ORG,
      resourceId: created.id,
    })
  })

  it("accepts the opposite normal balance for a contra account", async () => {
    const t = setup()
    const created = unwrap(
      await t.service.createAccount(ACTOR, ORG, account({ code: "1230", name: "Bad Debt Allowance", normalBalance: "CREDIT" }))
    )
    expect(created.normalBalance).toBe("CREDIT")
  })

  it("rejects a duplicate code, ignoring case", async () => {
    const t = setup()
    unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "A-100", name: "First" })))
    const result = await t.service.createAccount(ACTOR, ORG, account({ code: "a-100", name: "Second" }))
    expect(errorOf(result)).toBe("ACCOUNT_CODE_TAKEN")
  })

  it("allows the same code in another organization", async () => {
    const t = setup()
    unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    unwrap(await t.service.createAccount(ACTOR, OTHER_ORG, account()))
  })

  it("accepts a non-posting parent of the same type", async () => {
    const t = setup()
    await t.initChart()
    const parentId = await t.account("CURRENT_ASSETS")
    const created = unwrap(await t.service.createAccount(ACTOR, ORG, account({ parentId })))
    expect(created.parentId).toBe(parentId)
  })

  it.each([
    ["a posting parent", "CASH", "ASSET"],
    ["a parent of another type", "CURRENT_LIABILITIES", "ASSET"],
  ] as const)("rejects %s", async (_label, parentKey, type) => {
    const t = setup()
    await t.initChart()
    const parentId = await t.account(parentKey)
    const result = await t.service.createAccount(ACTOR, ORG, account({ parentId, type }))
    expect(errorOf(result)).toBe("ACCOUNT_PARENT_INVALID")
  })

  it("rejects a parent from another organization", async () => {
    const t = setup()
    await t.initChart(OTHER_ORG)
    const foreignParent = await t.account("CURRENT_ASSETS", OTHER_ORG)
    const result = await t.service.createAccount(ACTOR, ORG, account({ parentId: foreignParent }))
    expect(errorOf(result)).toBe("ACCOUNT_PARENT_INVALID")
  })

  it("renames a system account but not its place in the tree", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")

    const renamed = unwrap(await t.service.updateAccount(ACTOR, ORG, cash, { name: "Cash Box", code: "1111" }))
    expect(renamed).toMatchObject({ name: "Cash Box", code: "1111", isSystem: true })

    const moved = await t.service.updateAccount(ACTOR, ORG, cash, { parentId: await t.account("NON_CURRENT_ASSETS") })
    expect(errorOf(moved)).toBe("ACCOUNT_SYSTEM_READONLY")
    const flagged = await t.service.updateAccount(ACTOR, ORG, cash, { allowPosting: false })
    expect(errorOf(flagged)).toBe("ACCOUNT_SYSTEM_READONLY")
  })

  it("rejects a code that another account already uses", async () => {
    const t = setup()
    await t.initChart()
    const result = await t.service.updateAccount(ACTOR, ORG, await t.account("CASH"), { code: "1120" })
    expect(errorOf(result)).toBe("ACCOUNT_CODE_TAKEN")
  })

  it("cannot deactivate an account that a posting role points at", async () => {
    const t = setup()
    await t.initChart()
    const result = await t.service.updateAccount(ACTOR, ORG, await t.account("CASH"), { isActive: false })
    expect(errorOf(result)).toBe("ACCOUNT_IN_USE")
  })

  it("cannot stop an account with journal lines from allowing posting", async () => {
    const t = setup()
    await t.initChart()
    const custom = unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    const capital = await t.account("OWNERS_CAPITAL")
    const entry = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-01",
        lines: [line(custom.id, "debit", "500"), line(capital, "credit", "500")],
      })
    )
    unwrap(await t.service.postJournalEntry(ACTOR, ORG, entry.id))

    const result = await t.service.updateAccount(ACTOR, ORG, custom.id, { allowPosting: false })
    expect(errorOf(result)).toBe("ACCOUNT_IN_USE")
  })

  it("cannot move an account under itself or its descendant", async () => {
    const t = setup()
    await t.initChart()
    const group = unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "1300", name: "Group", allowPosting: false })))
    const child = unwrap(
      await t.service.createAccount(ACTOR, ORG, account({ code: "1310", name: "Child", allowPosting: false, parentId: group.id }))
    )
    const result = await t.service.updateAccount(ACTOR, ORG, group.id, { parentId: child.id })
    expect(errorOf(result)).toBe("ACCOUNT_PARENT_INVALID")
  })

  it("does not find another organization's account", async () => {
    const t = setup()
    await t.initChart(OTHER_ORG)
    const foreign = await t.account("CASH", OTHER_ORG)
    expect(errorOf(await t.service.updateAccount(ACTOR, ORG, foreign, { name: "Hijack" }))).toBe("ACCOUNT_NOT_FOUND")
    expect(errorOf(await t.service.getAccount(ORG, foreign))).toBe("ACCOUNT_NOT_FOUND")
    expect(errorOf(await t.service.deleteAccount(ACTOR, ORG, foreign))).toBe("ACCOUNT_NOT_FOUND")
  })

  it("deletes an unused custom account and audits it", async () => {
    const t = setup()
    const created = unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    expect(unwrap(await t.service.deleteAccount(ACTOR, ORG, created.id))).toEqual({ id: created.id })
    expect(await t.repository.findAccountById(ORG, created.id)).toBeNull()
    expect(t.events.at(-1)?.action).toBe(ActivityLogAction.ACCOUNTING_ACCOUNT_DELETED)
  })

  it("refuses to delete a system account, a parent, a mapped or a used account", async () => {
    const t = setup()
    await t.initChart()
    expect(errorOf(await t.service.deleteAccount(ACTOR, ORG, await t.account("CASH")))).toBe("ACCOUNT_SYSTEM_READONLY")

    const group = unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "1300", allowPosting: false })))
    unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "1310", name: "Child", parentId: group.id })))
    expect(errorOf(await t.service.deleteAccount(ACTOR, ORG, group.id))).toBe("ACCOUNT_IN_USE")

    const used = unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "1400", name: "Used" })))
    const capital = await t.account("OWNERS_CAPITAL")
    const entry = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-01",
        lines: [line(used.id, "debit", "5"), line(capital, "credit", "5")],
      })
    )
    unwrap(await t.service.postJournalEntry(ACTOR, ORG, entry.id))
    expect(errorOf(await t.service.deleteAccount(ACTOR, ORG, used.id))).toBe("ACCOUNT_IN_USE")

    const mappedAccount = unwrap(await t.service.createAccount(ACTOR, ORG, account({ code: "1500", name: "Mapped" })))
    unwrap(await t.service.updateMapping(ACTOR, ORG, "PREPAID_EXPENSES", { accountId: mappedAccount.id }))
    expect(errorOf(await t.service.deleteAccount(ACTOR, ORG, mappedAccount.id))).toBe("ACCOUNT_IN_USE")
  })

  it("lists only the caller's accounts, filtered and paged", async () => {
    const t = setup()
    await t.initChart()
    await t.initChart(OTHER_ORG)

    const all = unwrap(await t.service.listAccounts(ORG, { page: 1, pageSize: 100 }))
    expect(all.total).toBe(DEFAULT_ACCOUNTS.length)
    expect(all.items.every((a) => a.orgId === ORG)).toBe(true)

    const revenue = unwrap(await t.service.listAccounts(ORG, { page: 1, pageSize: 100, type: "REVENUE" }))
    expect(revenue.items.every((a) => a.type === "REVENUE")).toBe(true)

    const postable = unwrap(await t.service.listAccounts(ORG, { page: 1, pageSize: 100, postableOnly: true }))
    expect(postable.items.every((a) => a.allowPosting)).toBe(true)

    const found = unwrap(await t.service.listAccounts(ORG, { page: 1, pageSize: 100, search: "inventory" }))
    expect(found.items.length).toBeGreaterThan(0)

    const paged = unwrap(await t.service.listAccounts(ORG, { page: 2, pageSize: 10 }))
    expect(paged.items).toHaveLength(10)
    expect(paged.page).toBe(2)
  })
})

describe("account mappings", () => {
  it("lists a mapping for every posting role", async () => {
    const t = setup()
    await t.initChart()
    const { items } = unwrap(await t.service.listMappings(ORG))
    expect(items.map((m) => m.key).sort()).toEqual([...ACCOUNT_MAPPING_KEYS].sort())
  })

  it("points a role at another account of an allowed type and audits it", async () => {
    const t = setup()
    await t.initChart()
    const bank = await t.account("BANK")

    const updated = unwrap(await t.service.updateMapping(ACTOR, ORG, "CASH", { accountId: bank }))

    expect(updated).toMatchObject({ key: "CASH", accountId: bank })
    expect(await t.mapped("CASH")).toBe(bank)
    expect(t.events.at(-1)).toMatchObject({
      action: ActivityLogAction.ACCOUNTING_MAPPING_CHANGED,
      metadata: { key: "CASH", accountId: bank },
    })
  })

  it("rejects an account of the wrong type, a group account, an inactive account and a foreign account", async () => {
    const t = setup()
    await t.initChart()
    await t.initChart(OTHER_ORG)

    const revenue = await t.account("SALES_REVENUE")
    expect(errorOf(await t.service.updateMapping(ACTOR, ORG, "CASH", { accountId: revenue }))).toBe("ACCOUNT_MAPPING_INVALID")

    const group = await t.account("CURRENT_ASSETS")
    expect(errorOf(await t.service.updateMapping(ACTOR, ORG, "BANK", { accountId: group }))).toBe("ACCOUNT_CANNOT_POST")

    const spare = unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    unwrap(await t.service.updateAccount(ACTOR, ORG, spare.id, { isActive: false }))
    expect(errorOf(await t.service.updateMapping(ACTOR, ORG, "BANK", { accountId: spare.id }))).toBe("ACCOUNT_INACTIVE")

    const foreign = await t.account("BANK", OTHER_ORG)
    expect(errorOf(await t.service.updateMapping(ACTOR, ORG, "BANK", { accountId: foreign }))).toBe("ACCOUNT_MAPPING_INVALID")
    expect(await t.mapped("BANK")).toBe(await t.account("BANK"))
  })
})

describe("manual journal entries", () => {
  it("creates a numbered draft that no report sees", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")

    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        description: "  Seed money  ",
        lines: [line(cash, "debit", "100000"), line(capital, "credit", "100000")],
      })
    )

    expect(draft).toMatchObject({
      status: "DRAFT",
      entryNumber: formatJournalEntryNumber(1),
      description: "Seed money",
      currency: "EGP",
      totalDebit: "100000",
      totalCredit: "100000",
      postedAt: null,
    })
    expect(draft.lines).toHaveLength(2)
    const tb = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-12-31" }))
    expect(tb.rows).toHaveLength(0)
    expect(t.events.at(-1)?.action).toBe(ActivityLogAction.ACCOUNTING_JOURNAL_CREATED)
  })

  it("numbers entries one after another", async () => {
    const t = setup()
    await t.initChart()
    const first = await postedEntry(t, "2026-11-01", "100")
    const second = await postedEntry(t, "2026-11-02", "200")
    expect(first.entryNumber).toBe(formatJournalEntryNumber(1))
    expect(second.entryNumber).toBe(formatJournalEntryNumber(2))
  })

  it("rejects entries that do not balance or have an invalid line", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")

    expect(
      errorOf(
        await t.service.createJournalEntry(ACTOR, ORG, {
          date: "2026-11-10",
          lines: [line(cash, "debit", "100"), line(capital, "credit", "99")],
        })
      )
    ).toBe("JOURNAL_ENTRY_UNBALANCED")
    expect(
      errorOf(
        await t.service.createJournalEntry(ACTOR, ORG, {
          date: "2026-11-10",
          lines: [{ accountId: cash, debit: "100", credit: "100" }, line(capital, "credit", "0")],
        })
      )
    ).toBe("JOURNAL_ENTRY_INVALID_LINE")
    expect(
      errorOf(
        await t.service.createJournalEntry(ACTOR, ORG, {
          date: "2026-11-10",
          lines: [line(cash, "debit", "1.5"), line(capital, "credit", "1.5")],
        })
      )
    ).toBe("ACCOUNTING_INVALID_AMOUNT")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("rejects group, inactive and foreign accounts", async () => {
    const t = setup()
    await t.initChart()
    await t.initChart(OTHER_ORG)
    const capital = await t.account("OWNERS_CAPITAL")
    const spare = unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    unwrap(await t.service.updateAccount(ACTOR, ORG, spare.id, { isActive: false }))

    const attempt = (accountId: string) =>
      t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(accountId, "debit", "10"), line(capital, "credit", "10")],
      })

    expect(errorOf(await attempt(await t.account("CURRENT_ASSETS")))).toBe("ACCOUNT_CANNOT_POST")
    expect(errorOf(await attempt(spare.id))).toBe("ACCOUNT_INACTIVE")
    expect(errorOf(await attempt(await t.account("CASH", OTHER_ORG)))).toBe("JOURNAL_ENTRY_INVALID_LINE")
  })

  it("replaces the lines of a draft and keeps it a draft", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const bank = await t.account("BANK")
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(cash, "debit", "100"), line(capital, "credit", "100")],
      })
    )

    const updated = unwrap(
      await t.service.updateJournalEntry(ACTOR, ORG, draft.id, {
        date: "2026-11-11",
        description: "Moved to bank",
        lines: [line(bank, "debit", "250"), line(capital, "credit", "250")],
      })
    )

    expect(updated).toMatchObject({ status: "DRAFT", date: "2026-11-11", description: "Moved to bank", totalDebit: "250" })
    expect(updated.lines.map((l) => l.accountId)).toEqual([bank, capital])
    expect(await t.repository.allLines(ORG)).toHaveLength(2)
  })

  it("keeps the old lines when the replacement is invalid", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(cash, "debit", "100"), line(capital, "credit", "100")],
      })
    )
    const result = await t.service.updateJournalEntry(ACTOR, ORG, draft.id, {
      lines: [line(cash, "debit", "100"), line(capital, "credit", "1")],
    })
    expect(errorOf(result)).toBe("JOURNAL_ENTRY_UNBALANCED")
    expect(unwrap(await t.service.getJournalEntry(ORG, draft.id)).totalDebit).toBe("100")
  })

  it("posts a draft, and only once", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(cash, "debit", "700"), line(capital, "credit", "700")],
      })
    )

    const posted = unwrap(await t.service.postJournalEntry(ACTOR, ORG, draft.id))

    expect(posted).toMatchObject({ status: "POSTED", postedBy: ACTOR })
    expect(posted.postedAt).toBe("2026-11-15T10:00:00.000Z")
    expect(t.events.at(-1)?.action).toBe(ActivityLogAction.ACCOUNTING_JOURNAL_POSTED)
    expect(errorOf(await t.service.postJournalEntry(ACTOR, ORG, draft.id))).toBe("JOURNAL_ENTRY_ALREADY_POSTED")
    const tb = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-30" }))
    expect(tb.totalDebit).toBe("700")
    expect(tb.isBalanced).toBe(true)
  })

  it("checks the accounts again when posting", async () => {
    const t = setup()
    await t.initChart()
    const spare = unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(spare.id, "debit", "10"), line(capital, "credit", "10")],
      })
    )
    unwrap(await t.service.updateAccount(ACTOR, ORG, spare.id, { isActive: false }))

    expect(errorOf(await t.service.postJournalEntry(ACTOR, ORG, draft.id))).toBe("ACCOUNT_INACTIVE")
    expect(unwrap(await t.service.getJournalEntry(ORG, draft.id)).status).toBe("DRAFT")
  })

  it("freezes a posted entry: it cannot be edited or deleted", async () => {
    const t = setup()
    await t.initChart()
    const posted = await postedEntry(t, "2026-11-10", "100")
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")

    expect(
      errorOf(await t.service.updateJournalEntry(ACTOR, ORG, posted.id, { description: "Sneaky" }))
    ).toBe("JOURNAL_ENTRY_ALREADY_POSTED")
    expect(
      errorOf(
        await t.service.updateJournalEntry(ACTOR, ORG, posted.id, {
          lines: [line(cash, "debit", "1"), line(capital, "credit", "1")],
        })
      )
    ).toBe("JOURNAL_ENTRY_ALREADY_POSTED")
    expect(errorOf(await t.service.deleteJournalEntry(ACTOR, ORG, posted.id))).toBe("JOURNAL_ENTRY_ALREADY_POSTED")
    expect(unwrap(await t.service.getJournalEntry(ORG, posted.id)).totalDebit).toBe("100")
  })

  it("deletes a draft with its lines", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(cash, "debit", "5"), line(capital, "credit", "5")],
      })
    )

    expect(unwrap(await t.service.deleteJournalEntry(ACTOR, ORG, draft.id))).toEqual({ id: draft.id })
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
    expect(await t.repository.allLines(ORG)).toHaveLength(0)
    expect(t.events.at(-1)?.action).toBe(ActivityLogAction.ACCOUNTING_JOURNAL_DELETED)
  })

  it("does not show another organization's entries", async () => {
    const t = setup()
    await t.initChart()
    await t.initChart(OTHER_ORG)
    const posted = await postedEntry(t, "2026-11-10", "100")

    expect(errorOf(await t.service.getJournalEntry(OTHER_ORG, posted.id))).toBe("JOURNAL_ENTRY_NOT_FOUND")
    expect(errorOf(await t.service.postJournalEntry(ACTOR, OTHER_ORG, posted.id))).toBe("JOURNAL_ENTRY_NOT_FOUND")
    expect(errorOf(await t.service.reverseJournalEntry(ACTOR, OTHER_ORG, posted.id, {}))).toBe("JOURNAL_ENTRY_NOT_FOUND")
    expect(unwrap(await t.service.listJournalEntries(OTHER_ORG, { page: 1, pageSize: 50 })).total).toBe(0)
  })

  it("lists entries newest first and filters them", async () => {
    const t = setup()
    await t.initChart()
    await postedEntry(t, "2026-11-01", "100")
    await postedEntry(t, "2026-11-20", "200")
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-25",
        description: "Waiting for review",
        lines: [line(cash, "debit", "5"), line(capital, "credit", "5")],
      })
    )

    const all = unwrap(await t.service.listJournalEntries(ORG, { page: 1, pageSize: 50 }))
    expect(all.items.map((e) => e.date)).toEqual(["2026-11-25", "2026-11-20", "2026-11-01"])
    expect(unwrap(await t.service.listJournalEntries(ORG, { page: 1, pageSize: 50, status: "DRAFT" })).total).toBe(1)
    expect(unwrap(await t.service.listJournalEntries(ORG, { page: 1, pageSize: 50, from: "2026-11-10", to: "2026-11-30" })).total).toBe(2)
    expect(unwrap(await t.service.listJournalEntries(ORG, { page: 1, pageSize: 50, search: "waiting" })).total).toBe(1)
    expect(unwrap(await t.service.listJournalEntries(ORG, { page: 1, pageSize: 50, accountId: cash })).total).toBe(3)
  })
})

describe("reversals", () => {
  it("posts an equal and opposite entry and marks the original reversed", async () => {
    const t = setup()
    await t.initChart()
    const original = await postedEntry(t, "2026-11-10", "900")

    const reversal = unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, original.id, {}))

    expect(reversal).toMatchObject({
      status: "POSTED",
      reversalOfId: original.id,
      date: "2026-11-10",
      description: `Reversal of ${original.entryNumber}`,
      totalDebit: "900",
      totalCredit: "900",
    })
    const swapped = reversal.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit }))
    const source = (await t.repository.findLines(ORG, original.id)).map((l) => ({
      accountId: l.accountId,
      debit: String(l.credit),
      credit: String(l.debit),
    }))
    expect(swapped).toEqual(source)

    const after = unwrap(await t.service.getJournalEntry(ORG, original.id))
    expect(after.status).toBe("REVERSED")
    expect(after.reversedById).toBe(reversal.id)
    expect(t.events.at(-1)).toMatchObject({
      action: ActivityLogAction.ACCOUNTING_JOURNAL_REVERSED,
      resourceId: original.id,
    })
  })

  it("nets the books back to zero", async () => {
    const t = setup()
    await t.initChart()
    const original = await postedEntry(t, "2026-11-10", "900")
    unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, original.id, { date: "2026-11-12" }))

    const tb = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-30" }))
    expect(tb.rows).toHaveLength(0)
    expect(tb.totalDebit).toBe("0")
    const before = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-11" }))
    expect(before.totalDebit).toBe("900")
  })

  it("refuses a second reversal, a reversal of a reversal and a reversal of a draft", async () => {
    const t = setup()
    await t.initChart()
    const original = await postedEntry(t, "2026-11-10", "900")
    const reversal = unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, original.id, {}))

    expect(errorOf(await t.service.reverseJournalEntry(ACTOR, ORG, original.id, {}))).toBe("JOURNAL_ENTRY_ALREADY_REVERSED")
    expect(errorOf(await t.service.reverseJournalEntry(ACTOR, ORG, reversal.id, {}))).toBe("JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL")

    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(cash, "debit", "1"), line(capital, "credit", "1")],
      })
    )
    expect(errorOf(await t.service.reverseJournalEntry(ACTOR, ORG, draft.id, {}))).toBe("JOURNAL_ENTRY_NOT_POSTED")
    expect(await t.repository.allEntries(ORG)).toHaveLength(3)
  })

  it("still reverses an entry whose account was deactivated since", async () => {
    const t = setup()
    await t.initChart()
    const spare = unwrap(await t.service.createAccount(ACTOR, ORG, account()))
    const capital = await t.account("OWNERS_CAPITAL")
    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(spare.id, "debit", "10"), line(capital, "credit", "10")],
      })
    )
    unwrap(await t.service.postJournalEntry(ACTOR, ORG, draft.id))
    unwrap(await t.service.updateAccount(ACTOR, ORG, spare.id, { isActive: false }))

    expect(unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, draft.id, {})).status).toBe("POSTED")
  })

  it("rolls back completely when the original changed under it", async () => {
    const t = setup()
    await t.initChart()
    const original = await postedEntry(t, "2026-11-10", "900")
    // A concurrent reversal slips in between our check and our status change: the compare-and-set
    // fails, and the reversal we already wrote must not survive.
    const real = t.repository.updateEntry
    t.repository.updateEntry = async (orgId, id, expected, patch, tx) => {
      if (patch.status === "REVERSED") return null
      return real(orgId, id, expected, patch, tx)
    }

    const result = await t.service.reverseJournalEntry(ACTOR, ORG, original.id, {})

    expect(errorOf(result)).toBe("JOURNAL_ENTRY_ALREADY_REVERSED")
    expect(await t.repository.allEntries(ORG)).toHaveLength(1)
    expect(await t.repository.allLines(ORG)).toHaveLength(2)
  })
})

describe("accounting periods", () => {
  it("creates periods that do not overlap", async () => {
    const t = setup()
    const created = unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "October 2026", startDate: "2026-10-01", endDate: "2026-10-31" }))
    expect(created).toMatchObject({ status: "OPEN", closedAt: null })
    unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))

    expect(
      errorOf(await t.service.createPeriod(ACTOR, ORG, { name: "Overlap", startDate: "2026-10-31", endDate: "2026-11-02" }))
    ).toBe("ACCOUNTING_PERIOD_OVERLAP")
    expect(
      errorOf(await t.service.createPeriod(ACTOR, ORG, { name: "Backwards", startDate: "2026-12-31", endDate: "2026-12-01" }))
    ).toBe("ACCOUNTING_INVALID_DATE_RANGE")
    unwrap(await t.service.createPeriod(ACTOR, OTHER_ORG, { name: "Same dates, other org", startDate: "2026-10-01", endDate: "2026-10-31" }))

    const list = unwrap(await t.service.listPeriods(ORG))
    expect(list.items.map((p) => p.name)).toEqual(["November 2026", "October 2026"])
  })

  it("closes a period once", async () => {
    const t = setup()
    const period = unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "October 2026", startDate: "2026-10-01", endDate: "2026-10-31" }))

    const closed = unwrap(await t.service.closePeriod(ACTOR, ORG, period.id))

    expect(closed).toMatchObject({ status: "CLOSED", closedBy: ACTOR })
    expect(closed.closedAt).toBe("2026-11-15T10:00:00.000Z")
    expect(errorOf(await t.service.closePeriod(ACTOR, ORG, period.id))).toBe("ACCOUNTING_PERIOD_ALREADY_CLOSED")
    expect(errorOf(await t.service.closePeriod(ACTOR, OTHER_ORG, period.id))).toBe("ACCOUNTING_PERIOD_NOT_FOUND")
    expect(t.events.map((e) => e.action)).toContain(ActivityLogAction.ACCOUNTING_PERIOD_CLOSED)
  })

  it("blocks posting and reversing into a closed period, but not drafting or other dates", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    const inNovember = await postedEntry(t, "2026-11-05", "100")
    const period = unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))
    unwrap(await t.service.closePeriod(ACTOR, ORG, period.id))

    const draft = unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-20",
        lines: [line(cash, "debit", "5"), line(capital, "credit", "5")],
      })
    )
    expect(errorOf(await t.service.postJournalEntry(ACTOR, ORG, draft.id))).toBe("JOURNAL_ENTRY_PERIOD_CLOSED")
    expect(errorOf(await t.service.reverseJournalEntry(ACTOR, ORG, inNovember.id, {}))).toBe("JOURNAL_ENTRY_PERIOD_CLOSED")
    expect(unwrap(await t.service.getJournalEntry(ORG, inNovember.id)).status).toBe("POSTED")

    // A reversal can be dated in an open period instead.
    const moved = unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, inNovember.id, { date: "2026-12-02" }))
    expect(moved.date).toBe("2026-12-02")
    unwrap(await t.service.updateJournalEntry(ACTOR, ORG, draft.id, { date: "2026-12-05" }))
    expect(unwrap(await t.service.postJournalEntry(ACTOR, ORG, draft.id)).status).toBe("POSTED")
  })

  it("is not affected by another organization's closed period", async () => {
    const t = setup()
    await t.initChart()
    const period = unwrap(await t.service.createPeriod(ACTOR, OTHER_ORG, { name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))
    unwrap(await t.service.closePeriod(ACTOR, OTHER_ORG, period.id))
    expect((await postedEntry(t, "2026-11-10", "100")).status).toBe("POSTED")
  })
})

describe("failure isolation", () => {
  it("a thrown error rolls the whole write back", async () => {
    const t = setup()
    await t.initChart()
    const cash = await t.account("CASH")
    const capital = await t.account("OWNERS_CAPITAL")
    const real = t.repository.insertLines
    t.repository.insertLines = async () => {
      throw new Error("database went away")
    }

    const error = await thrown(() =>
      t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-10",
        lines: [line(cash, "debit", "5"), line(capital, "credit", "5")],
      })
    )

    expect(error.message).toBe("database went away")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
    t.repository.insertLines = real
  })
})
