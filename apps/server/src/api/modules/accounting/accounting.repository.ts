import { and, asc, count, desc, eq, gte, ilike, inArray, lt, lte, or, sql } from "drizzle-orm"
import {
  REPORTABLE_JOURNAL_STATUSES,
  type AccountMappingKey,
  type AccountOffsetListQuery,
  type JournalEntryOffsetListQuery,
  type JournalEntryStatus,
} from "@avuny/contracts"
import {
  accountMappings,
  accountingPeriods,
  accounts,
  journalEntries,
  journalEntryLines,
  organizations,
  type Account,
  type AccountMapping,
  type AccountingPeriod,
  type DB,
  type JournalEntry,
  type JournalEntryLine,
  type NewAccount,
  type NewAccountingPeriod,
  type NewJournalEntry,
  type NewJournalEntryLine,
  type Tx,
} from "@avuny/db"
import { isForeignKeyViolation, isUniqueViolation } from "../shared/pg-errors.js"
import type { AccountUsage } from "./accounting.rules.js"

const ACCOUNT_CODE_INDEXES = ["ux_account_org_code"] as const
const ACCOUNT_SYSTEM_KEY_INDEXES = ["ux_account_org_system_key"] as const
const ACCOUNT_PARENT_FKS = ["fk_account_parent"] as const

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

export type AccountWriteResult =
  | { ok: true; row: Account }
  | { ok: false; reason: "code_taken" | "system_key_taken" | "parent_invalid" | "not_found" }

export type AccountDeleteResult = { ok: true } | { ok: false; reason: "not_found" | "in_use" }

export type AccountPatchValues = Partial<
  Pick<NewAccount, "code" | "name" | "description" | "parentId" | "allowPosting" | "isActive">
>

export type AccountMappingRow = {
  mapping: AccountMapping
  account: Pick<Account, "id" | "code" | "name">
}

export type OrganizationSettings = { id: string; defaultCurrency: string; timezone: string }

/** A journal entry header with what the lists need: the totals of its lines and who reversed it. */
export type JournalEntryView = {
  entry: JournalEntry
  totalDebit: string
  totalCredit: string
  reversedById: string | null
}

export type JournalEntryPatchValues = Partial<
  Pick<NewJournalEntry, "status" | "date" | "description" | "postedAt" | "postedBy">
>

export type AccountTotals = { debit: bigint; credit: bigint }

/** Which posted lines to sum or list. Dates are business dates (YYYY-MM-DD), both ends inclusive. */
export interface LedgerFilter {
  accountId?: string
  from?: string
  to?: string
  /** Strictly before this date: the opening balance of a range. */
  before?: string
}

export type LedgerLineRow = {
  entryId: string
  entryNumber: string
  date: string
  entryDescription: string | null
  lineDescription: string | null
  sourceType: string | null
  sourceRef: string | null
  debit: number
  credit: number
}

export type PeriodWriteResult = { ok: true; row: AccountingPeriod } | { ok: false; reason: "not_found" }

export function createAccountingRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  /* ---------- shared query pieces ---------- */

  const linesToEntries = and(
    eq(journalEntries.orgId, journalEntryLines.orgId),
    eq(journalEntries.id, journalEntryLines.journalEntryId)
  )

  /** Reports and ledgers read posted lines only: drafts never count, reversed originals do. */
  const reportable = inArray(journalEntries.status, [...REPORTABLE_JOURNAL_STATUSES])

  const ledgerWhere = (orgId: string, f: LedgerFilter) =>
    and(
      eq(journalEntryLines.orgId, orgId),
      eq(journalEntries.orgId, orgId),
      reportable,
      f.accountId ? eq(journalEntryLines.accountId, f.accountId) : undefined,
      f.from ? gte(journalEntries.date, f.from) : undefined,
      f.to ? lte(journalEntries.date, f.to) : undefined,
      f.before ? lt(journalEntries.date, f.before) : undefined
    )

  const ledgerOrder = [
    asc(journalEntries.date),
    asc(journalEntries.entrySeq),
    asc(journalEntryLines.lineNo),
  ] as const

  const entryViewColumns = {
    entry: journalEntries,
    totalDebit: sql<string>`(select coalesce(sum(${journalEntryLines.debit}), 0)::text from ${journalEntryLines} where ${journalEntryLines.orgId} = ${journalEntries.orgId} and ${journalEntryLines.journalEntryId} = ${journalEntries.id})`,
    totalCredit: sql<string>`(select coalesce(sum(${journalEntryLines.credit}), 0)::text from ${journalEntryLines} where ${journalEntryLines.orgId} = ${journalEntries.orgId} and ${journalEntryLines.journalEntryId} = ${journalEntries.id})`,
    reversedById: sql<string | null>`(select r.id from journal_entries r where r.org_id = ${journalEntries.orgId} and r.reversal_of_id = ${journalEntries.id} limit 1)`,
  }

  const toTotals = (row: { debit: string; credit: string } | undefined): AccountTotals => ({
    debit: BigInt(row?.debit ?? "0"),
    credit: BigInt(row?.credit ?? "0"),
  })

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes every check-then-write sequence of the books of one organization. */
    async lockOrg(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`accounting:${orgId}`}, 0))`)
    },

    /* ---------- organization ---------- */

    /** The currency and time zone the books are kept in. */
    async findOrganizationSettings(orgId: string, tx?: Tx): Promise<OrganizationSettings | null> {
      const [row] = await exec(tx)
        .select({
          id: organizations.id,
          defaultCurrency: organizations.defaultCurrency,
          timezone: organizations.timezone,
        })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1)
      return row ?? null
    },

    /* ---------- accounts ---------- */

    async findAccountById(orgId: string, id: string, tx?: Tx): Promise<Account | null> {
      const [row] = await exec(tx)
        .select()
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)))
        .limit(1)
      return row ?? null
    },

    findAccountsByIds(orgId: string, ids: readonly string[], tx?: Tx): Promise<Account[]> {
      if (ids.length === 0) return Promise.resolve([])
      return exec(tx)
        .select()
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), inArray(accounts.id, [...ids])))
    },

    /** Every account of the organization, by code: the tree, the reports and the initializer read this. */
    listAllAccounts(orgId: string, tx?: Tx): Promise<Account[]> {
      return exec(tx).select().from(accounts).where(eq(accounts.orgId, orgId)).orderBy(asc(accounts.code))
    },

    async listAccounts(
      orgId: string,
      q: AccountOffsetListQuery,
      tx?: Tx
    ): Promise<{ rows: Account[]; total: number }> {
      const needle = q.search ? `%${escapeLike(q.search)}%` : undefined
      const where = and(
        eq(accounts.orgId, orgId),
        needle ? or(ilike(accounts.code, needle), ilike(accounts.name, needle)) : undefined,
        q.type ? eq(accounts.type, q.type) : undefined,
        q.isActive === undefined ? undefined : eq(accounts.isActive, q.isActive),
        q.postableOnly ? eq(accounts.allowPosting, true) : undefined
      )
      const e = exec(tx)
      const rows = await e
        .select()
        .from(accounts)
        .where(where)
        .orderBy(asc(accounts.code))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize)
      const [totalRow] = await e.select({ total: count() }).from(accounts).where(where)
      return { rows, total: totalRow?.total ?? 0 }
    },

    async insertAccount(values: NewAccount, tx?: Tx): Promise<AccountWriteResult> {
      try {
        const [row] = await exec(tx).insert(accounts).values(values).returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, ACCOUNT_CODE_INDEXES)) return { ok: false, reason: "code_taken" }
        if (isUniqueViolation(err, ACCOUNT_SYSTEM_KEY_INDEXES)) return { ok: false, reason: "system_key_taken" }
        if (isForeignKeyViolation(err, ACCOUNT_PARENT_FKS)) return { ok: false, reason: "parent_invalid" }
        throw err
      }
    },

    /**
     * Idempotent insert for the initializer: a conflict (a concurrent initialization) is not an
     * error and, unlike a thrown unique violation, leaves the caller's transaction usable.
     */
    async insertAccountIfMissing(values: NewAccount, tx?: Tx): Promise<Account | null> {
      const [row] = await exec(tx).insert(accounts).values(values).onConflictDoNothing().returning()
      return row ?? null
    },

    async updateAccount(
      orgId: string,
      id: string,
      patch: AccountPatchValues,
      tx?: Tx
    ): Promise<AccountWriteResult> {
      try {
        const [row] = await exec(tx)
          .update(accounts)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)))
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, ACCOUNT_CODE_INDEXES)) return { ok: false, reason: "code_taken" }
        if (isForeignKeyViolation(err, ACCOUNT_PARENT_FKS)) return { ok: false, reason: "parent_invalid" }
        throw err
      }
    },

    async deleteAccount(orgId: string, id: string, tx?: Tx): Promise<AccountDeleteResult> {
      try {
        const rows = await exec(tx)
          .delete(accounts)
          .where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)))
          .returning({ id: accounts.id })
        return rows.length > 0 ? { ok: true } : { ok: false, reason: "not_found" }
      } catch (err) {
        // Journal lines, mappings and child accounts all reference the account with ON DELETE RESTRICT.
        if (isForeignKeyViolation(err)) return { ok: false, reason: "in_use" }
        throw err
      }
    },

    /** What still points at the account (each lookup stops at the first row). */
    async getAccountUsage(orgId: string, id: string, tx?: Tx): Promise<AccountUsage> {
      const e = exec(tx)
      const child = await e
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.parentId, id)))
        .limit(1)
      const line = await e
        .select({ id: journalEntryLines.id })
        .from(journalEntryLines)
        .where(and(eq(journalEntryLines.orgId, orgId), eq(journalEntryLines.accountId, id)))
        .limit(1)
      const mapping = await e
        .select({ id: accountMappings.id })
        .from(accountMappings)
        .where(and(eq(accountMappings.orgId, orgId), eq(accountMappings.accountId, id)))
        .limit(1)
      return { hasChildren: child.length > 0, hasLines: line.length > 0, isMapped: mapping.length > 0 }
    },

    /* ---------- account mappings ---------- */

    listMappings(orgId: string, tx?: Tx): Promise<AccountMappingRow[]> {
      return exec(tx)
        .select({
          mapping: accountMappings,
          account: { id: accounts.id, code: accounts.code, name: accounts.name },
        })
        .from(accountMappings)
        .innerJoin(
          accounts,
          and(eq(accounts.orgId, accountMappings.orgId), eq(accounts.id, accountMappings.accountId))
        )
        .where(eq(accountMappings.orgId, orgId))
        .orderBy(asc(accountMappings.mappingKey))
    },

    findMappings(orgId: string, keys: readonly AccountMappingKey[], tx?: Tx): Promise<AccountMapping[]> {
      if (keys.length === 0) return Promise.resolve([])
      return exec(tx)
        .select()
        .from(accountMappings)
        .where(and(eq(accountMappings.orgId, orgId), inArray(accountMappings.mappingKey, [...keys])))
    },

    /** One row per (organization, role): changing a mapping replaces its account. */
    async upsertMapping(orgId: string, key: AccountMappingKey, accountId: string, tx?: Tx): Promise<AccountMapping> {
      const [row] = await exec(tx)
        .insert(accountMappings)
        .values({ orgId, mappingKey: key, accountId })
        .onConflictDoUpdate({
          target: [accountMappings.orgId, accountMappings.mappingKey],
          set: { accountId, updatedAt: new Date() },
        })
        .returning()
      if (!row) throw new Error("Upserting an account mapping returned no row")
      return row
    },

    /** Initializer: adds the roles that have no mapping yet and never touches an existing one. */
    async insertMappingsIfMissing(
      values: readonly { orgId: string; mappingKey: AccountMappingKey; accountId: string }[],
      tx?: Tx
    ): Promise<void> {
      if (values.length === 0) return
      await exec(tx).insert(accountMappings).values([...values]).onConflictDoNothing()
    },

    /* ---------- journal entries ---------- */

    /** Next entry number sequence. Call it under lockOrg: two concurrent posts would read the same max. */
    async nextEntrySeq(orgId: string, tx: Tx): Promise<number> {
      const [row] = await tx
        .select({ max: sql<number>`coalesce(max(${journalEntries.entrySeq}), 0)` })
        .from(journalEntries)
        .where(eq(journalEntries.orgId, orgId))
      return (row?.max ?? 0) + 1
    },

    /**
     * Null when a unique index refused the row (source posted twice, reversed twice). Callers check
     * first under lockOrg, so this is the backstop, and it keeps the transaction usable.
     */
    async insertEntry(values: NewJournalEntry, tx: Tx): Promise<JournalEntry | null> {
      const [row] = await tx.insert(journalEntries).values(values).onConflictDoNothing().returning()
      return row ?? null
    },

    insertLines(values: NewJournalEntryLine[], tx: Tx): Promise<JournalEntryLine[]> {
      return tx.insert(journalEntryLines).values(values).returning()
    },

    async findEntryView(orgId: string, id: string, tx?: Tx): Promise<JournalEntryView | null> {
      const [row] = await exec(tx)
        .select(entryViewColumns)
        .from(journalEntries)
        .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.id, id)))
        .limit(1)
      return row ?? null
    },

    findLines(orgId: string, entryId: string, tx?: Tx): Promise<JournalEntryLine[]> {
      return exec(tx)
        .select()
        .from(journalEntryLines)
        .where(and(eq(journalEntryLines.orgId, orgId), eq(journalEntryLines.journalEntryId, entryId)))
        .orderBy(asc(journalEntryLines.lineNo))
    },

    /** The original posting of a source document (reversals are excluded, as in the unique index). */
    async findEntryBySource(
      orgId: string,
      sourceType: string,
      sourceId: string,
      tx?: Tx
    ): Promise<JournalEntry | null> {
      const [row] = await exec(tx)
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.orgId, orgId),
            eq(journalEntries.sourceType, sourceType),
            eq(journalEntries.sourceId, sourceId),
            sql`${journalEntries.reversalOfId} is null`
          )
        )
        .limit(1)
      return row ?? null
    },

    async findReversalOf(orgId: string, originalId: string, tx?: Tx): Promise<JournalEntry | null> {
      const [row] = await exec(tx)
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.reversalOfId, originalId)))
        .limit(1)
      return row ?? null
    },

    async listEntryViews(
      orgId: string,
      q: JournalEntryOffsetListQuery,
      tx?: Tx
    ): Promise<{ rows: JournalEntryView[]; total: number }> {
      const needle = q.search ? `%${escapeLike(q.search)}%` : undefined
      const where = and(
        eq(journalEntries.orgId, orgId),
        q.status ? eq(journalEntries.status, q.status) : undefined,
        q.from ? gte(journalEntries.date, q.from) : undefined,
        q.to ? lte(journalEntries.date, q.to) : undefined,
        q.sourceType ? eq(journalEntries.sourceType, q.sourceType) : undefined,
        q.accountId
          ? sql`exists (select 1 from ${journalEntryLines} where ${journalEntryLines.orgId} = ${journalEntries.orgId} and ${journalEntryLines.journalEntryId} = ${journalEntries.id} and ${journalEntryLines.accountId} = ${q.accountId})`
          : undefined,
        needle
          ? or(
              ilike(journalEntries.entryNumber, needle),
              ilike(journalEntries.description, needle),
              ilike(journalEntries.sourceRef, needle)
            )
          : undefined
      )
      const e = exec(tx)
      const rows = await e
        .select(entryViewColumns)
        .from(journalEntries)
        .where(where)
        .orderBy(desc(journalEntries.date), desc(journalEntries.entrySeq))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize)
      const [totalRow] = await e.select({ total: count() }).from(journalEntries).where(where)
      return { rows, total: totalRow?.total ?? 0 }
    },

    /** Compare-and-set on the status: null when the entry is gone or no longer has `expected`. */
    async updateEntry(
      orgId: string,
      id: string,
      expected: JournalEntryStatus,
      patch: JournalEntryPatchValues,
      tx: Tx
    ): Promise<JournalEntry | null> {
      const [row] = await tx
        .update(journalEntries)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.id, id), eq(journalEntries.status, expected)))
        .returning()
      return row ?? null
    },

    async deleteLines(orgId: string, entryId: string, tx: Tx): Promise<void> {
      await tx
        .delete(journalEntryLines)
        .where(and(eq(journalEntryLines.orgId, orgId), eq(journalEntryLines.journalEntryId, entryId)))
    },

    /** Only a draft can be deleted: the status is part of the condition. */
    async deleteDraftEntry(orgId: string, id: string, tx: Tx): Promise<boolean> {
      const rows = await tx
        .delete(journalEntries)
        .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.id, id), eq(journalEntries.status, "DRAFT")))
        .returning({ id: journalEntries.id })
      return rows.length > 0
    },

    /* ---------- reports ---------- */

    /** Debit and credit sums per account over the posted lines that match the filter. */
    async sumByAccount(orgId: string, f: LedgerFilter, tx?: Tx): Promise<Map<string, AccountTotals>> {
      const rows = await exec(tx)
        .select({
          accountId: journalEntryLines.accountId,
          debit: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)::text`,
          credit: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)::text`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, linesToEntries)
        .where(ledgerWhere(orgId, f))
        .groupBy(journalEntryLines.accountId)
      return new Map(rows.map((r) => [r.accountId, toTotals(r)]))
    },

    async countLedgerLines(orgId: string, f: LedgerFilter, tx?: Tx): Promise<number> {
      const [row] = await exec(tx)
        .select({ total: count() })
        .from(journalEntryLines)
        .innerJoin(journalEntries, linesToEntries)
        .where(ledgerWhere(orgId, f))
      return row?.total ?? 0
    },

    /** One page of an account's ledger, oldest first (date, then entry number, then line). */
    listLedgerLines(
      orgId: string,
      f: LedgerFilter,
      page: { limit: number; offset: number },
      tx?: Tx
    ): Promise<LedgerLineRow[]> {
      return exec(tx)
        .select({
          entryId: journalEntries.id,
          entryNumber: journalEntries.entryNumber,
          date: journalEntries.date,
          entryDescription: journalEntries.description,
          lineDescription: journalEntryLines.description,
          sourceType: journalEntries.sourceType,
          sourceRef: journalEntries.sourceRef,
          debit: journalEntryLines.debit,
          credit: journalEntryLines.credit,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, linesToEntries)
        .where(ledgerWhere(orgId, f))
        .orderBy(...ledgerOrder)
        .limit(page.limit)
        .offset(page.offset)
    },

    /** Totals of the first `count` lines of the ledger: the balance a page starts from. */
    async sumLedgerPrefix(orgId: string, f: LedgerFilter, rowCount: number, tx?: Tx): Promise<AccountTotals> {
      if (rowCount <= 0) return { debit: 0n, credit: 0n }
      const e = exec(tx)
      const prefix = e
        .select({ debit: journalEntryLines.debit, credit: journalEntryLines.credit })
        .from(journalEntryLines)
        .innerJoin(journalEntries, linesToEntries)
        .where(ledgerWhere(orgId, f))
        .orderBy(...ledgerOrder)
        .limit(rowCount)
        .as("ledger_prefix")
      const [row] = await e
        .select({
          debit: sql<string>`coalesce(sum(${prefix.debit}), 0)::text`,
          credit: sql<string>`coalesce(sum(${prefix.credit}), 0)::text`,
        })
        .from(prefix)
      return toTotals(row)
    },

    /* ---------- accounting periods ---------- */

    listPeriods(orgId: string, tx?: Tx): Promise<AccountingPeriod[]> {
      return exec(tx)
        .select()
        .from(accountingPeriods)
        .where(eq(accountingPeriods.orgId, orgId))
        .orderBy(desc(accountingPeriods.startDate))
    },

    async findPeriodById(orgId: string, id: string, tx?: Tx): Promise<AccountingPeriod | null> {
      const [row] = await exec(tx)
        .select()
        .from(accountingPeriods)
        .where(and(eq(accountingPeriods.orgId, orgId), eq(accountingPeriods.id, id)))
        .limit(1)
      return row ?? null
    },

    /** The closed period that contains the date, if any: the only kind that blocks a posting. */
    async findClosedPeriodContaining(orgId: string, date: string, tx?: Tx): Promise<AccountingPeriod | null> {
      const [row] = await exec(tx)
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.orgId, orgId),
            eq(accountingPeriods.status, "CLOSED"),
            lte(accountingPeriods.startDate, date),
            gte(accountingPeriods.endDate, date)
          )
        )
        .limit(1)
      return row ?? null
    },

    /** Any period that shares at least one day with the range (both ends inclusive). */
    async findOverlappingPeriod(
      orgId: string,
      startDate: string,
      endDate: string,
      tx?: Tx
    ): Promise<AccountingPeriod | null> {
      const [row] = await exec(tx)
        .select()
        .from(accountingPeriods)
        .where(
          and(
            eq(accountingPeriods.orgId, orgId),
            lte(accountingPeriods.startDate, endDate),
            gte(accountingPeriods.endDate, startDate)
          )
        )
        .limit(1)
      return row ?? null
    },

    async insertPeriod(values: NewAccountingPeriod, tx?: Tx): Promise<AccountingPeriod> {
      const [row] = await exec(tx).insert(accountingPeriods).values(values).returning()
      if (!row) throw new Error("Inserting an accounting period returned no row")
      return row
    },

    /** OPEN to CLOSED only: null when the period is gone or was already closed. */
    async closePeriod(orgId: string, id: string, closedBy: string, closedAt: Date, tx?: Tx): Promise<PeriodWriteResult> {
      const [row] = await exec(tx)
        .update(accountingPeriods)
        .set({ status: "CLOSED", closedAt, closedBy, updatedAt: new Date() })
        .where(
          and(eq(accountingPeriods.orgId, orgId), eq(accountingPeriods.id, id), eq(accountingPeriods.status, "OPEN"))
        )
        .returning()
      return row ? { ok: true, row } : { ok: false, reason: "not_found" }
    },
  }
}
