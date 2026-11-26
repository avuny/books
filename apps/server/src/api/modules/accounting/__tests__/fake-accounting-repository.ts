import type {
  Account,
  AccountMapping,
  AccountingPeriod,
  JournalEntry,
  JournalEntryLine,
  Tx,
} from "@avuny/db"
import type {
  AccountMappingRow,
  AccountWriteResult,
  JournalEntryView,
  LedgerFilter,
} from "../accounting.repository.js"
import type { AccountingRepository } from "../accounting.types.js"

/**
 * An in-memory AccountingRepository for the service tests. It enforces the same rules as the
 * database (unique code and system key per organization, one posting per source document, one
 * reversal per entry, compare-and-set on the status, restrict on delete) and it rolls its state
 * back when a transaction throws, so tests can prove "nothing was saved" without a database.
 */
export interface FakeAccountingRepository extends AccountingRepository {
  /** Registers an organization's accounting settings. */
  addOrganization(id: string, settings?: { defaultCurrency?: string; timezone?: string }): void
  /** Test peek: every journal entry of an organization, oldest first. */
  allEntries(orgId: string): JournalEntry[]
  allLines(orgId: string): JournalEntryLine[]
}

interface State {
  accounts: Account[]
  mappings: AccountMapping[]
  entries: JournalEntry[]
  lines: JournalEntryLine[]
  periods: AccountingPeriod[]
}

const NOW = new Date("2026-11-15T10:00:00Z")

export function createFakeAccountingRepository(): FakeAccountingRepository {
  let state: State = { accounts: [], mappings: [], entries: [], lines: [], periods: [] }
  const orgs = new Map<string, { id: string; defaultCurrency: string; timezone: string }>()
  let counter = 0
  const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`
  const clone = (s: State): State => ({
    accounts: s.accounts.map((r) => ({ ...r })),
    mappings: s.mappings.map((r) => ({ ...r })),
    entries: s.entries.map((r) => ({ ...r })),
    lines: s.lines.map((r) => ({ ...r })),
    periods: s.periods.map((r) => ({ ...r })),
  })

  const byOrg = <T extends { orgId: string }>(rows: T[], orgId: string) => rows.filter((r) => r.orgId === orgId)
  const sameCode = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

  const view = (e: JournalEntry): JournalEntryView => {
    const lines = state.lines.filter((l) => l.orgId === e.orgId && l.journalEntryId === e.id)
    return {
      entry: { ...e },
      totalDebit: lines.reduce((n, l) => n + BigInt(l.debit), 0n).toString(),
      totalCredit: lines.reduce((n, l) => n + BigInt(l.credit), 0n).toString(),
      reversedById: state.entries.find((r) => r.orgId === e.orgId && r.reversalOfId === e.id)?.id ?? null,
    }
  }

  const reportable = (e: JournalEntry) => e.status === "POSTED" || e.status === "REVERSED"
  const ledger = (orgId: string, f: LedgerFilter) =>
    state.lines
      .flatMap((line) => {
        const entry = state.entries.find((e) => e.orgId === orgId && e.id === line.journalEntryId)
        return entry && line.orgId === orgId ? [{ line, entry }] : []
      })
      .filter(
        ({ line, entry }) =>
          reportable(entry) &&
          (!f.accountId || line.accountId === f.accountId) &&
          (!f.from || entry.date >= f.from) &&
          (!f.to || entry.date <= f.to) &&
          (!f.before || entry.date < f.before)
      )
      .sort(
        (a, b) =>
          a.entry.date.localeCompare(b.entry.date) ||
          a.entry.entrySeq - b.entry.entrySeq ||
          a.line.lineNo - b.line.lineNo
      )

  const repo: FakeAccountingRepository = {
    addOrganization(id, settings = {}) {
      orgs.set(id, { id, defaultCurrency: settings.defaultCurrency ?? "EGP", timezone: settings.timezone ?? "Africa/Cairo" })
    },
    allEntries: (orgId) => byOrg(state.entries, orgId).sort((a, b) => a.entrySeq - b.entrySeq),
    allLines: (orgId) => byOrg(state.lines, orgId),

    async transaction(fn) {
      const before = clone(state)
      try {
        return await fn({} as Tx)
      } catch (err) {
        state = before
        throw err
      }
    },
    async lockOrg() {},

    async findOrganizationSettings(orgId) {
      return orgs.get(orgId) ?? null
    },

    /* accounts */
    async findAccountById(orgId, id) {
      return state.accounts.find((a) => a.orgId === orgId && a.id === id) ?? null
    },
    async findAccountsByIds(orgId, ids) {
      return state.accounts.filter((a) => a.orgId === orgId && ids.includes(a.id))
    },
    async listAllAccounts(orgId) {
      return byOrg(state.accounts, orgId).sort((a, b) => a.code.localeCompare(b.code))
    },
    async listAccounts(orgId, q) {
      const needle = q.search?.toLowerCase()
      const all = byOrg(state.accounts, orgId)
        .filter(
          (a) =>
            (!needle || a.code.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle)) &&
            (!q.type || a.type === q.type) &&
            (q.isActive === undefined || a.isActive === q.isActive) &&
            (!q.postableOnly || a.allowPosting)
        )
        .sort((a, b) => a.code.localeCompare(b.code))
      const start = (q.page - 1) * q.pageSize
      return { rows: all.slice(start, start + q.pageSize), total: all.length }
    },
    async insertAccount(values): Promise<AccountWriteResult> {
      if (state.accounts.some((a) => a.orgId === values.orgId && sameCode(a.code, values.code))) {
        return { ok: false, reason: "code_taken" }
      }
      if (values.systemKey && state.accounts.some((a) => a.orgId === values.orgId && a.systemKey === values.systemKey)) {
        return { ok: false, reason: "system_key_taken" }
      }
      if (values.parentId && !state.accounts.some((a) => a.orgId === values.orgId && a.id === values.parentId)) {
        return { ok: false, reason: "parent_invalid" }
      }
      const row: Account = {
        id: newId(),
        description: null,
        parentId: null,
        systemKey: null,
        isActive: true,
        allowPosting: true,
        createdAt: NOW,
        updatedAt: NOW,
        ...values,
      }
      state.accounts.push(row)
      return { ok: true, row: { ...row } }
    },
    async insertAccountIfMissing(values) {
      const taken = state.accounts.some(
        (a) => a.orgId === values.orgId && (sameCode(a.code, values.code) || (values.systemKey && a.systemKey === values.systemKey))
      )
      if (taken) return null
      const result = await repo.insertAccount(values)
      return result.ok ? result.row : null
    },
    async updateAccount(orgId, id, patch): Promise<AccountWriteResult> {
      const row = state.accounts.find((a) => a.orgId === orgId && a.id === id)
      if (!row) return { ok: false, reason: "not_found" }
      if (patch.code && state.accounts.some((a) => a.orgId === orgId && a.id !== id && sameCode(a.code, patch.code ?? ""))) {
        return { ok: false, reason: "code_taken" }
      }
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) Object.assign(row, { [k]: v })
      row.updatedAt = NOW
      return { ok: true, row: { ...row } }
    },
    async deleteAccount(orgId, id) {
      const row = state.accounts.find((a) => a.orgId === orgId && a.id === id)
      if (!row) return { ok: false, reason: "not_found" }
      const used =
        state.accounts.some((a) => a.orgId === orgId && a.parentId === id) ||
        state.lines.some((l) => l.orgId === orgId && l.accountId === id) ||
        state.mappings.some((m) => m.orgId === orgId && m.accountId === id)
      if (used) return { ok: false, reason: "in_use" }
      state.accounts = state.accounts.filter((a) => a !== row)
      return { ok: true }
    },
    async getAccountUsage(orgId, id) {
      return {
        hasChildren: state.accounts.some((a) => a.orgId === orgId && a.parentId === id),
        hasLines: state.lines.some((l) => l.orgId === orgId && l.accountId === id),
        isMapped: state.mappings.some((m) => m.orgId === orgId && m.accountId === id),
      }
    },

    /* mappings */
    async listMappings(orgId): Promise<AccountMappingRow[]> {
      return byOrg(state.mappings, orgId)
        .sort((a, b) => a.mappingKey.localeCompare(b.mappingKey))
        .flatMap((mapping) => {
          const account = state.accounts.find((a) => a.orgId === orgId && a.id === mapping.accountId)
          return account ? [{ mapping: { ...mapping }, account: { id: account.id, code: account.code, name: account.name } }] : []
        })
    },
    async findMappings(orgId, keys) {
      return state.mappings.filter((m) => m.orgId === orgId && keys.includes(m.mappingKey)).map((m) => ({ ...m }))
    },
    async upsertMapping(orgId, key, accountId) {
      const existing = state.mappings.find((m) => m.orgId === orgId && m.mappingKey === key)
      if (existing) {
        existing.accountId = accountId
        existing.updatedAt = NOW
        return { ...existing }
      }
      const row: AccountMapping = { id: newId(), orgId, mappingKey: key, accountId, createdAt: NOW, updatedAt: NOW }
      state.mappings.push(row)
      return { ...row }
    },
    async insertMappingsIfMissing(values) {
      for (const v of values) {
        if (!state.mappings.some((m) => m.orgId === v.orgId && m.mappingKey === v.mappingKey)) {
          state.mappings.push({ id: newId(), createdAt: NOW, updatedAt: NOW, ...v })
        }
      }
    },

    /* journal entries */
    async nextEntrySeq(orgId) {
      return Math.max(0, ...byOrg(state.entries, orgId).map((e) => e.entrySeq)) + 1
    },
    async insertEntry(values) {
      const sourceTaken =
        values.sourceId &&
        !values.reversalOfId &&
        state.entries.some(
          (e) =>
            e.orgId === values.orgId && e.sourceType === values.sourceType && e.sourceId === values.sourceId && !e.reversalOfId
        )
      const reversalTaken =
        values.reversalOfId && state.entries.some((e) => e.orgId === values.orgId && e.reversalOfId === values.reversalOfId)
      if (sourceTaken || reversalTaken) return null
      const row: JournalEntry = {
        id: newId(),
        description: null,
        status: "DRAFT",
        sourceType: null,
        sourceId: null,
        sourceRef: null,
        reversalOfId: null,
        createdBy: null,
        postedAt: null,
        postedBy: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...values,
      }
      state.entries.push(row)
      return { ...row }
    },
    async insertLines(values) {
      const rows = values.map(
        (v): JournalEntryLine => ({
          id: newId(),
          description: null,
          debit: 0,
          credit: 0,
          createdAt: NOW,
          updatedAt: NOW,
          ...v,
        })
      )
      state.lines.push(...rows)
      return rows.map((r) => ({ ...r }))
    },
    async findEntryView(orgId, id) {
      const e = state.entries.find((x) => x.orgId === orgId && x.id === id)
      return e ? view(e) : null
    },
    async findLines(orgId, entryId) {
      return state.lines
        .filter((l) => l.orgId === orgId && l.journalEntryId === entryId)
        .sort((a, b) => a.lineNo - b.lineNo)
        .map((l) => ({ ...l }))
    },
    async findEntryBySource(orgId, sourceType, sourceId) {
      const e = state.entries.find(
        (x) => x.orgId === orgId && x.sourceType === sourceType && x.sourceId === sourceId && !x.reversalOfId
      )
      return e ? { ...e } : null
    },
    async findReversalOf(orgId, originalId) {
      const e = state.entries.find((x) => x.orgId === orgId && x.reversalOfId === originalId)
      return e ? { ...e } : null
    },
    async listEntryViews(orgId, q) {
      const needle = q.search?.toLowerCase()
      const all = byOrg(state.entries, orgId)
        .filter(
          (e) =>
            (!q.status || e.status === q.status) &&
            (!q.from || e.date >= q.from) &&
            (!q.to || e.date <= q.to) &&
            (!q.sourceType || e.sourceType === q.sourceType) &&
            (!q.accountId || state.lines.some((l) => l.journalEntryId === e.id && l.accountId === q.accountId)) &&
            (!needle ||
              [e.entryNumber, e.description, e.sourceRef].some((t) => t?.toLowerCase().includes(needle)))
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.entrySeq - a.entrySeq)
      const start = (q.page - 1) * q.pageSize
      return { rows: all.slice(start, start + q.pageSize).map(view), total: all.length }
    },
    async updateEntry(orgId, id, expected, patch) {
      const row = state.entries.find((e) => e.orgId === orgId && e.id === id && e.status === expected)
      if (!row) return null
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) Object.assign(row, { [k]: v })
      row.updatedAt = NOW
      return { ...row }
    },
    async deleteLines(orgId, entryId) {
      state.lines = state.lines.filter((l) => !(l.orgId === orgId && l.journalEntryId === entryId))
    },
    async deleteDraftEntry(orgId, id) {
      const row = state.entries.find((e) => e.orgId === orgId && e.id === id && e.status === "DRAFT")
      if (!row) return false
      state.entries = state.entries.filter((e) => e !== row)
      return true
    },

    /* reports */
    async sumByAccount(orgId, f) {
      const totals = new Map<string, { debit: bigint; credit: bigint }>()
      for (const { line } of ledger(orgId, f)) {
        const t = totals.get(line.accountId) ?? { debit: 0n, credit: 0n }
        t.debit += BigInt(line.debit)
        t.credit += BigInt(line.credit)
        totals.set(line.accountId, t)
      }
      return totals
    },
    async countLedgerLines(orgId, f) {
      return ledger(orgId, f).length
    },
    async listLedgerLines(orgId, f, page) {
      return ledger(orgId, f)
        .slice(page.offset, page.offset + page.limit)
        .map(({ line, entry }) => ({
          entryId: entry.id,
          entryNumber: entry.entryNumber,
          date: entry.date,
          entryDescription: entry.description,
          lineDescription: line.description,
          sourceType: entry.sourceType,
          sourceRef: entry.sourceRef,
          debit: line.debit,
          credit: line.credit,
        }))
    },
    async sumLedgerPrefix(orgId, f, rowCount) {
      const t = { debit: 0n, credit: 0n }
      for (const { line } of ledger(orgId, f).slice(0, Math.max(rowCount, 0))) {
        t.debit += BigInt(line.debit)
        t.credit += BigInt(line.credit)
      }
      return t
    },

    /* periods */
    async listPeriods(orgId) {
      return byOrg(state.periods, orgId).sort((a, b) => b.startDate.localeCompare(a.startDate))
    },
    async findPeriodById(orgId, id) {
      return state.periods.find((p) => p.orgId === orgId && p.id === id) ?? null
    },
    async findClosedPeriodContaining(orgId, date) {
      return (
        state.periods.find((p) => p.orgId === orgId && p.status === "CLOSED" && p.startDate <= date && p.endDate >= date) ?? null
      )
    },
    async findOverlappingPeriod(orgId, startDate, endDate) {
      return state.periods.find((p) => p.orgId === orgId && p.startDate <= endDate && p.endDate >= startDate) ?? null
    },
    async insertPeriod(values) {
      const row: AccountingPeriod = {
        id: newId(),
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...values,
      }
      state.periods.push(row)
      return { ...row }
    },
    async closePeriod(orgId, id, closedBy, closedAt) {
      const row = state.periods.find((p) => p.orgId === orgId && p.id === id && p.status === "OPEN")
      if (!row) return { ok: false, reason: "not_found" }
      Object.assign(row, { status: "CLOSED", closedAt, closedBy, updatedAt: NOW })
      return { ok: true, row: { ...row } }
    },
  }
  return repo
}
