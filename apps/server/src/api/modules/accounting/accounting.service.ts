import { fail, ok } from "@avuny/utils"
import {
  ACCOUNT_MAPPING_KEYS,
  ACCOUNTING_SOURCE_TYPES,
  AccountingErrorCode as Err,
  ActivityLogAction,
  DEFAULT_ACCOUNT_MAPPINGS,
  DEFAULT_ACCOUNTS,
  buildInventoryOpeningTemplate,
  buildPostingTemplate,
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  businessToday,
  checkJournalLines,
  formatJournalEntryNumber,
  minorToStorage,
  parseMinorAmount,
  signedBalance,
  toBusinessDate,
  type AccountMappingKey,
  type AccountMappingDto,
  type AccountMappingListResponse,
  type AccountOffsetListQuery,
  type AccountOffsetListResponse,
  type AccountingErrorCode as Code,
  type AccountingPeriodDto,
  type AccountingPeriodListResponse,
  type BalanceSheetQuery,
  type BalanceSheetResponse,
  type CheckedJournalLine,
  type CreateAccountInput,
  type CreateAccountingPeriodInput,
  type CreateJournalEntryInput,
  type DeleteAccountResponse,
  type DeleteJournalEntryResponse,
  type GeneralLedgerQuery,
  type GeneralLedgerResponse,
  type JournalEntryOffsetListQuery,
  type JournalEntryOffsetListResponse,
  type PostBusinessEventInput,
  type PostInventoryOpeningBalanceInput,
  type PostOpeningBalancesInput,
  type ProfitAndLossQuery,
  type ProfitAndLossResponse,
  type ReverseJournalEntryInput,
  type TrialBalanceQuery,
  type TrialBalanceResponse,
  type UpdateAccountInput,
  type UpdateAccountMappingInput,
  type UpdateJournalEntryInput,
} from "@avuny/contracts"
import type { Account, JournalEntry, JournalEntryLine, Tx } from "@avuny/db"
import { createFailureKit, type Failure } from "../shared/service-helpers.js"
import {
  toAccountDto,
  toAccountMappingDto,
  toAccountingPeriodDto,
  toJournalEntryDto,
  toJournalEntryListItemDto,
} from "./accounting.mapper.js"
import {
  buildOpeningBalanceLines,
  checkDelete,
  checkMappingTarget,
  checkParent,
  checkPostable,
  checkUpdate,
  resolveNormalBalance,
} from "./accounting.rules.js"
import type {
  AccountPatchValues,
  AccountTotals,
  AccountWriteResult,
  LedgerFilter,
} from "./accounting.repository.js"
import { DummyActivityLog } from "./testing.js"
import type { AccountingServiceDeps } from "./accounting.types.js"

/* ---------- small pure helpers ---------- */

const ZERO_TOTALS: AccountTotals = { debit: 0n, credit: 0n }

const indexOf = (accounts: readonly Account[]): Map<string, Account> => new Map(accounts.map((a) => [a.id, a]))

const sumLines = (lines: readonly Pick<JournalEntryLine, "debit" | "credit">[]) =>
  lines.reduce(
    (acc, l) => ({ debit: acc.debit + BigInt(l.debit), credit: acc.credit + BigInt(l.credit) }),
    { debit: 0n, credit: 0n }
  )

const lineLabel = (index: number) => `Line ${index + 1}`

/** What the initializer reports; a second run creates nothing. */
export interface InitializeChartResult {
  accountsCreated: number
  mappingsCreated: number
}

/* ---------- service ---------- */

export const createAccountingService = ({
  repository: repo,
  activityLog = new DummyActivityLog(),
  now = () => new Date(),
}: AccountingServiceDeps) => {
  const { failure, fromViolation, isFailure, toFail, abort, abortable } = createFailureKit<Code>()

  const accountNotFound = () => failure(Err.ACCOUNT_NOT_FOUND, "Account not found")
  const entryNotFound = () => failure(Err.JOURNAL_ENTRY_NOT_FOUND, "Journal entry not found")

  const audit = (
    action: ActivityLogAction,
    actorId: string,
    orgId: string,
    resourceId: string,
    metadata?: Record<string, unknown>
  ) => activityLog.log({ action, actorId, orgId, resourceId, metadata })

  const accountWriteFailure = (r: Extract<AccountWriteResult, { ok: false }>, code: string): Failure<Code> => {
    switch (r.reason) {
      case "code_taken":
        return failure(Err.ACCOUNT_CODE_TAKEN, `An account with the code ${code} already exists`)
      case "parent_invalid":
        return failure(Err.ACCOUNT_PARENT_INVALID, "The parent account does not exist in this organization")
      case "not_found":
        return accountNotFound()
      case "system_key_taken":
        throw new Error("A user-created account collided with a system key")
    }
  }

  const loadSettings = async (orgId: string, tx: Tx) => {
    const settings = await repo.findOrganizationSettings(orgId, tx)
    if (!settings) throw new Error(`Organization ${orgId} does not exist`)
    return settings
  }

  /** A date that falls in a closed accounting period cannot take a new posting. */
  const assertPeriodOpen = async (orgId: string, date: string, tx: Tx): Promise<Failure<Code> | null> => {
    const closed = await repo.findClosedPeriodContaining(orgId, date, tx)
    return closed
      ? failure(Err.JOURNAL_ENTRY_PERIOD_CLOSED, `${date} falls in the closed accounting period "${closed.name}"`)
      : null
  }

  /**
   * Checks the structure of the lines, then that every account exists in THIS organization and can
   * take a posting. Returns the checked lines (BigInt amounts) or the failure to report.
   */
  const checkLinesAndAccounts = async (
    orgId: string,
    candidates: readonly { accountId: string; debit: string; credit: string; description?: string | null }[],
    tx: Tx
  ): Promise<Failure<Code> | CheckedJournalLine[]> => {
    const structure = checkJournalLines(candidates)
    if (!structure.ok) return failure(structure.error, structure.msg)

    const found = indexOf(await repo.findAccountsByIds(orgId, [...new Set(structure.lines.map((l) => l.accountId))], tx))
    for (const [i, line] of structure.lines.entries()) {
      const account = found.get(line.accountId)
      if (!account) {
        return failure(Err.JOURNAL_ENTRY_INVALID_LINE, `${lineLabel(i)}: the account does not exist in this organization`)
      }
      const notPostable = checkPostable(account)
      if (notPostable) return failure(notPostable.error, `${lineLabel(i)}: ${notPostable.msg}`)
    }
    return structure.lines
  }

  /** Mapped accounts for the given roles, each checked again for type, active and postable. */
  const resolveMapped = async (
    orgId: string,
    keys: readonly AccountMappingKey[],
    tx: Tx
  ): Promise<Failure<Code> | Map<AccountMappingKey, string>> => {
    const unique = [...new Set(keys)]
    const byKey = new Map((await repo.findMappings(orgId, unique, tx)).map((m) => [m.mappingKey, m.accountId]))
    const missing = unique.filter((k) => !byKey.has(k))
    if (missing.length > 0) {
      return failure(Err.ACCOUNT_MAPPING_MISSING, `No account is mapped to: ${missing.join(", ")}`)
    }
    const accounts = indexOf(await repo.findAccountsByIds(orgId, [...byKey.values()], tx))
    for (const key of unique) {
      const accountId = byKey.get(key)
      const violation = checkMappingTarget(key, accountId ? accounts.get(accountId) : undefined)
      if (violation) return failure(violation.error, `${key}: ${violation.msg}`)
    }
    return byKey
  }

  interface WriteEntryArgs {
    orgId: string
    actorId: string | null
    date: string
    description: string | null
    currency: string
    status: "DRAFT" | "POSTED"
    lines: readonly CheckedJournalLine[]
    source?: { type: string; id: string | null; ref: string | null }
    reversalOfId?: string
  }

  /**
   * The one place that creates a journal entry. The caller holds lockOrg, so the checks below and
   * the writes cannot interleave with another posting. Every business check runs BEFORE the first
   * write, so a returned failure leaves nothing behind in the caller's transaction.
   */
  const writeEntry = async (
    tx: Tx,
    a: WriteEntryArgs
  ): Promise<Failure<Code> | { entry: JournalEntry; lines: JournalEntryLine[] }> => {
    if (a.status === "POSTED") {
      const closed = await assertPeriodOpen(a.orgId, a.date, tx)
      if (closed) return closed
    }
    if (a.source?.id && a.reversalOfId === undefined) {
      const existing = await repo.findEntryBySource(a.orgId, a.source.type, a.source.id, tx)
      if (existing) {
        return failure(
          Err.JOURNAL_ENTRY_DUPLICATE_SOURCE,
          `Journal entry ${existing.entryNumber} already exists for this ${a.source.type}`
        )
      }
    }

    const seq = await repo.nextEntrySeq(a.orgId, tx)
    const entry = await repo.insertEntry(
      {
        orgId: a.orgId,
        entrySeq: seq,
        entryNumber: formatJournalEntryNumber(seq),
        date: a.date,
        description: a.description,
        status: a.status,
        currency: a.currency,
        sourceType: a.source?.type ?? null,
        sourceId: a.source?.id ?? null,
        sourceRef: a.source?.ref ?? null,
        reversalOfId: a.reversalOfId ?? null,
        createdBy: a.actorId,
        postedAt: a.status === "POSTED" ? now() : null,
        postedBy: a.status === "POSTED" ? a.actorId : null,
      },
      tx
    )
    if (!entry) {
      return a.reversalOfId === undefined
        ? failure(Err.JOURNAL_ENTRY_DUPLICATE_SOURCE, "A journal entry already exists for this source document")
        : failure(Err.JOURNAL_ENTRY_ALREADY_REVERSED, "The journal entry has already been reversed")
    }

    const lines = await repo.insertLines(
      a.lines.map((l, i) => ({
        orgId: a.orgId,
        journalEntryId: entry.id,
        lineNo: i + 1,
        accountId: l.accountId,
        description: l.description,
        debit: minorToStorage(l.debit),
        credit: minorToStorage(l.credit),
      })),
      tx
    )
    return { entry, lines }
  }

  const entryDto = (entry: JournalEntry, lines: readonly JournalEntryLine[], reversedById: string | null = null) => {
    const totals = sumLines(lines)
    return toJournalEntryDto(
      { entry, totalDebit: totals.debit.toString(), totalCredit: totals.credit.toString(), reversedById },
      lines
    )
  }

  /** Runs in the caller's transaction when there is one, otherwise in a transaction of its own. */
  const inTx = <T>(tx: Tx | undefined, fn: (t: Tx) => Promise<T>): Promise<T> =>
    tx ? fn(tx) : repo.transaction(fn)

  return {
    /* ---------- chart of accounts ---------- */

    /**
     * Creates the default chart and the default account mappings for an organization, inside the
     * caller's transaction. Idempotent: whatever exists (by system key) is kept as it is, so a re-run
     * never overwrites a customized name or mapping. Every conflict is detected BEFORE the first
     * write; a failure after a write (which only a concurrent writer could cause) must make the
     * caller roll back its transaction.
     */
    async initializeChartOfAccounts(orgId: string, tx: Tx) {
      await repo.lockOrg(orgId, tx)
      const existing = await repo.listAllAccounts(orgId, tx)
      const byKey = new Map<string, Account>()
      for (const a of existing) if (a.systemKey) byKey.set(a.systemKey, a)
      const codes = new Set(existing.map((a) => a.code.toLowerCase()))

      const missing = DEFAULT_ACCOUNTS.filter((d) => !byKey.has(d.systemKey))
      for (const def of missing) {
        if (codes.has(def.code.toLowerCase())) {
          return fail({
            error: Err.ACCOUNT_CODE_TAKEN,
            msg: `The code ${def.code} of the default account "${def.name}" is already used by another account`,
          })
        }
      }

      let accountsCreated = 0
      for (const def of missing) {
        // DEFAULT_ACCOUNTS lists parents first, so the parent is in `byKey` by now.
        const parentId = def.parentSystemKey ? (byKey.get(def.parentSystemKey)?.id ?? null) : null
        if (def.parentSystemKey && !parentId) {
          return fail({ error: Err.ACCOUNT_PARENT_INVALID, msg: `The parent of ${def.code} is missing` })
        }
        const row = await repo.insertAccountIfMissing(
          {
            orgId,
            code: def.code,
            name: def.name,
            description: null,
            type: def.type,
            normalBalance: def.normalBalance,
            parentId,
            systemKey: def.systemKey,
            isActive: true,
            allowPosting: def.allowPosting,
          },
          tx
        )
        if (!row) {
          return fail({
            error: Err.ACCOUNT_CODE_TAKEN,
            msg: `The default account ${def.code} was created concurrently`,
          })
        }
        byKey.set(def.systemKey, row)
        accountsCreated += 1
      }

      const mapped = new Set((await repo.findMappings(orgId, ACCOUNT_MAPPING_KEYS, tx)).map((m) => m.mappingKey))
      const toInsert: { orgId: string; mappingKey: AccountMappingKey; accountId: string }[] = []
      for (const def of DEFAULT_ACCOUNT_MAPPINGS) {
        if (mapped.has(def.key)) continue
        const account = byKey.get(def.accountSystemKey)
        if (!account) {
          return fail({
            error: Err.ACCOUNT_MAPPING_MISSING,
            msg: `The default account for ${def.key} (${def.accountSystemKey}) does not exist`,
          })
        }
        toInsert.push({ orgId, mappingKey: def.key, accountId: account.id })
      }
      await repo.insertMappingsIfMissing(toInsert, tx)

      return ok({
        data: { accountsCreated, mappingsCreated: toInsert.length } satisfies InitializeChartResult,
        msg: "Chart of accounts initialized",
      })
    },

    async createAccount(actorId: string, orgId: string, input: CreateAccountInput) {
      const code = input.code.trim()
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const all = await repo.listAllAccounts(orgId, tx)
        if (all.some((a) => a.code.toLowerCase() === code.toLowerCase())) {
          return failure(Err.ACCOUNT_CODE_TAKEN, `An account with the code ${code} already exists`)
        }
        if (input.parentId) {
          const violation = checkParent({ type: input.type, parentId: input.parentId, accounts: indexOf(all) })
          if (violation) return fromViolation(violation)
        }
        const inserted = await repo.insertAccount(
          {
            orgId,
            code,
            name: input.name.trim(),
            description: input.description ?? null,
            type: input.type,
            normalBalance: resolveNormalBalance(input.type, input.normalBalance),
            parentId: input.parentId ?? null,
            systemKey: null,
            isActive: true,
            allowPosting: input.allowPosting,
          },
          tx
        )
        return inserted.ok ? inserted.row : accountWriteFailure(inserted, code)
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_ACCOUNT_CREATED, actorId, orgId, result.id, {
        code: result.code,
        type: result.type,
      })
      return ok({ data: toAccountDto(result), msg: "Account created successfully" })
    },

    async updateAccount(actorId: string, orgId: string, id: string, input: UpdateAccountInput) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const all = await repo.listAllAccounts(orgId, tx)
        const accounts = indexOf(all)
        const account = accounts.get(id)
        if (!account) return accountNotFound()

        const code = input.code?.trim()
        if (code !== undefined && code.toLowerCase() !== account.code.toLowerCase()) {
          if (all.some((a) => a.id !== id && a.code.toLowerCase() === code.toLowerCase())) {
            return failure(Err.ACCOUNT_CODE_TAKEN, `An account with the code ${code} already exists`)
          }
        }
        if (input.parentId && input.parentId !== account.parentId) {
          const violation = checkParent({ type: account.type, accountId: id, parentId: input.parentId, accounts })
          if (violation) return fromViolation(violation)
        }

        const usage = await repo.getAccountUsage(orgId, id, tx)
        const blocked = checkUpdate({
          account,
          patch: { parentId: input.parentId, allowPosting: input.allowPosting, isActive: input.isActive },
          usage,
        })
        if (blocked) return fromViolation(blocked)

        const patch: AccountPatchValues = {
          code,
          name: input.name?.trim(),
          description: input.description,
          parentId: input.parentId,
          allowPosting: input.allowPosting,
          isActive: input.isActive,
        }
        const updated = await repo.updateAccount(orgId, id, patch, tx)
        return updated.ok ? updated.row : accountWriteFailure(updated, code ?? account.code)
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_ACCOUNT_UPDATED, actorId, orgId, id, {
        changed: Object.keys(input).filter((k) => input[k as keyof UpdateAccountInput] !== undefined),
      })
      return ok({ data: toAccountDto(result), msg: "Account updated successfully" })
    },

    async deleteAccount(actorId: string, orgId: string, id: string) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const account = await repo.findAccountById(orgId, id, tx)
        if (!account) return accountNotFound()

        const blocked = checkDelete({ account, usage: await repo.getAccountUsage(orgId, id, tx) })
        if (blocked) return fromViolation(blocked)

        const deleted = await repo.deleteAccount(orgId, id, tx)
        if (deleted.ok) return account
        return deleted.reason === "not_found"
          ? accountNotFound()
          : failure(Err.ACCOUNT_IN_USE, "The account is still used by other records")
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_ACCOUNT_DELETED, actorId, orgId, id, { code: result.code })
      return ok({ data: { id } satisfies DeleteAccountResponse, msg: "Account deleted successfully" })
    },

    async getAccount(orgId: string, id: string) {
      const row = await repo.findAccountById(orgId, id)
      if (!row) return toFail(accountNotFound())
      return ok({ data: toAccountDto(row) })
    },

    async listAccounts(orgId: string, query: AccountOffsetListQuery) {
      const { rows, total } = await repo.listAccounts(orgId, query)
      return ok({
        data: {
          items: rows.map(toAccountDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        } satisfies AccountOffsetListResponse,
      })
    },

    /* ---------- account mappings ---------- */

    async listMappings(orgId: string) {
      const rows = await repo.listMappings(orgId)
      return ok({ data: { items: rows.map(toAccountMappingDto) } satisfies AccountMappingListResponse })
    },

    async updateMapping(actorId: string, orgId: string, key: AccountMappingKey, input: UpdateAccountMappingInput) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        // A cross-organization id is simply not found here, so it is rejected like an unknown one.
        const account = await repo.findAccountById(orgId, input.accountId, tx)
        const violation = checkMappingTarget(key, account ?? undefined)
        if (violation || !account) {
          return violation
            ? fromViolation(violation)
            : failure(Err.ACCOUNT_MAPPING_INVALID, "The account does not exist in this organization")
        }
        const [previous] = await repo.findMappings(orgId, [key], tx)
        const mapping = await repo.upsertMapping(orgId, key, account.id, tx)
        return { row: { mapping, account: { id: account.id, code: account.code, name: account.name } }, previous }
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_MAPPING_CHANGED, actorId, orgId, result.row.mapping.id, {
        key,
        accountId: result.row.account.id,
        previousAccountId: result.previous?.accountId ?? null,
      })
      return ok({ data: toAccountMappingDto(result.row) satisfies AccountMappingDto, msg: "Account mapping updated" })
    },

    /* ---------- manual journal entries ---------- */

    async createJournalEntry(actorId: string, orgId: string, input: CreateJournalEntryInput) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const settings = await loadSettings(orgId, tx)
        const lines = await checkLinesAndAccounts(orgId, input.lines, tx)
        if (isFailure(lines)) return lines
        return writeEntry(tx, {
          orgId,
          actorId,
          date: input.date,
          description: input.description?.trim() || null,
          currency: settings.defaultCurrency,
          status: "DRAFT",
          lines,
        })
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_JOURNAL_CREATED, actorId, orgId, result.entry.id, {
        entryNumber: result.entry.entryNumber,
      })
      return ok({ data: entryDto(result.entry, result.lines), msg: "Journal entry created successfully" })
    },

    async updateJournalEntry(actorId: string, orgId: string, id: string, input: UpdateJournalEntryInput) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const view = await repo.findEntryView(orgId, id, tx)
        if (!view) return entryNotFound()
        if (view.entry.status !== "DRAFT") {
          return failure(Err.JOURNAL_ENTRY_ALREADY_POSTED, "Only a draft journal entry can be changed")
        }

        let replacement: CheckedJournalLine[] | null = null
        if (input.lines) {
          const checked = await checkLinesAndAccounts(orgId, input.lines, tx)
          if (isFailure(checked)) return checked
          replacement = checked
        }

        const updated = await repo.updateEntry(
          orgId,
          id,
          "DRAFT",
          {
            date: input.date,
            description: input.description === undefined ? undefined : input.description?.trim() || null,
          },
          tx
        )
        if (!updated) return failure(Err.JOURNAL_ENTRY_ALREADY_POSTED, "Only a draft journal entry can be changed")

        if (replacement) {
          await repo.deleteLines(orgId, id, tx)
          await repo.insertLines(
            replacement.map((l, i) => ({
              orgId,
              journalEntryId: id,
              lineNo: i + 1,
              accountId: l.accountId,
              description: l.description,
              debit: minorToStorage(l.debit),
              credit: minorToStorage(l.credit),
            })),
            tx
          )
        }
        return { entry: updated, lines: await repo.findLines(orgId, id, tx) }
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_JOURNAL_UPDATED, actorId, orgId, id, {
        entryNumber: result.entry.entryNumber,
      })
      return ok({ data: entryDto(result.entry, result.lines), msg: "Journal entry updated successfully" })
    },

    async deleteJournalEntry(actorId: string, orgId: string, id: string) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const view = await repo.findEntryView(orgId, id, tx)
        if (!view) return entryNotFound()
        if (view.entry.status !== "DRAFT") {
          return failure(Err.JOURNAL_ENTRY_ALREADY_POSTED, "Only a draft journal entry can be deleted")
        }
        await repo.deleteLines(orgId, id, tx)
        if (!(await repo.deleteDraftEntry(orgId, id, tx))) {
          return failure(Err.JOURNAL_ENTRY_ALREADY_POSTED, "Only a draft journal entry can be deleted")
        }
        return view.entry
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_JOURNAL_DELETED, actorId, orgId, id, {
        entryNumber: result.entryNumber,
      })
      return ok({ data: { id } satisfies DeleteJournalEntryResponse, msg: "Journal entry deleted successfully" })
    },

    /** DRAFT to POSTED. The lines are validated again, because accounts may have changed since the draft. */
    async postJournalEntry(actorId: string, orgId: string, id: string) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const view = await repo.findEntryView(orgId, id, tx)
        if (!view) return entryNotFound()
        if (view.entry.status !== "DRAFT") {
          return failure(Err.JOURNAL_ENTRY_ALREADY_POSTED, "The journal entry is already posted")
        }

        const stored = await repo.findLines(orgId, id, tx)
        const checked = await checkLinesAndAccounts(
          orgId,
          stored.map((l) => ({
            accountId: l.accountId,
            debit: String(l.debit),
            credit: String(l.credit),
            description: l.description,
          })),
          tx
        )
        if (isFailure(checked)) return checked
        const closed = await assertPeriodOpen(orgId, view.entry.date, tx)
        if (closed) return closed

        const posted = await repo.updateEntry(orgId, id, "DRAFT", { status: "POSTED", postedAt: now(), postedBy: actorId }, tx)
        if (!posted) return failure(Err.JOURNAL_ENTRY_ALREADY_POSTED, "The journal entry is already posted")
        return { entry: posted, lines: stored }
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_JOURNAL_POSTED, actorId, orgId, id, {
        entryNumber: result.entry.entryNumber,
      })
      return ok({ data: entryDto(result.entry, result.lines), msg: "Journal entry posted successfully" })
    },

    /**
     * Reverses a POSTED entry by posting a new entry with every debit and credit swapped, then marking
     * the original REVERSED. Nothing is edited or deleted, so the trail stays complete.
     */
    async reverseJournalEntry(actorId: string, orgId: string, id: string, input: ReverseJournalEntryInput) {
      const result = await abortable(() =>
        repo.transaction(async (tx) => {
          await repo.lockOrg(orgId, tx)
          const view = await repo.findEntryView(orgId, id, tx)
          if (!view) return entryNotFound()
          const original = view.entry
          if (original.reversalOfId !== null) {
            return failure(Err.JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL, "A reversal cannot be reversed")
          }
          if (original.status === "DRAFT") {
            return failure(Err.JOURNAL_ENTRY_NOT_POSTED, "Only a posted journal entry can be reversed")
          }
          if (original.status === "REVERSED" || view.reversedById !== null) {
            return failure(Err.JOURNAL_ENTRY_ALREADY_REVERSED, "The journal entry has already been reversed")
          }

          const stored = await repo.findLines(orgId, id, tx)
          // Swapped sides cancel the original exactly. Accounts that were deactivated since are fine:
          // a reversal only undoes history.
          const swapped: CheckedJournalLine[] = stored.map((l) => ({
            accountId: l.accountId,
            debit: BigInt(l.credit),
            credit: BigInt(l.debit),
            description: l.description,
          }))

          const written = await writeEntry(tx, {
            orgId,
            actorId,
            date: input.date ?? original.date,
            description: input.description?.trim() || `Reversal of ${original.entryNumber}`,
            currency: original.currency,
            status: "POSTED",
            lines: swapped,
            source: original.sourceType
              ? { type: original.sourceType, id: original.sourceId, ref: original.sourceRef }
              : undefined,
            reversalOfId: original.id,
          })
          if (isFailure(written)) return written

          const marked = await repo.updateEntry(orgId, id, "POSTED", { status: "REVERSED" }, tx)
          // The reversal is already written: roll the whole transaction back instead of returning.
          if (!marked) {
            return abort(failure(Err.JOURNAL_ENTRY_ALREADY_REVERSED, "The journal entry has already been reversed"))
          }
          return { original: marked, reversal: written.entry, lines: written.lines }
        })
      )
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_JOURNAL_REVERSED, actorId, orgId, id, {
        entryNumber: result.original.entryNumber,
        reversalId: result.reversal.id,
        reversalNumber: result.reversal.entryNumber,
      })
      return ok({
        data: entryDto(result.reversal, result.lines),
        msg: "Journal entry reversed successfully",
      })
    },

    async getJournalEntry(orgId: string, id: string) {
      const view = await repo.findEntryView(orgId, id)
      if (!view) return toFail(entryNotFound())
      const lines = await repo.findLines(orgId, id)
      return ok({ data: toJournalEntryDto(view, lines) })
    },

    async listJournalEntries(orgId: string, query: JournalEntryOffsetListQuery) {
      const { rows, total } = await repo.listEntryViews(orgId, query)
      return ok({
        data: {
          items: rows.map(toJournalEntryListItemDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        } satisfies JournalEntryOffsetListResponse,
      })
    },

    /* ---------- opening balances ---------- */

    /**
     * One posted entry for the starting position of the books (assets, liabilities, capital). The
     * balancing line goes to Opening Balance Equity, which is resolved from the mapping.
     */
    async postOpeningBalances(actorId: string, orgId: string, input: PostOpeningBalancesInput) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const settings = await loadSettings(orgId, tx)
        const mapped = await resolveMapped(orgId, ["OPENING_BALANCE_EQUITY"], tx)
        if (isFailure(mapped)) return mapped
        const equityAccountId = mapped.get("OPENING_BALANCE_EQUITY")
        if (!equityAccountId) return failure(Err.ACCOUNT_MAPPING_MISSING, "No account is mapped to OPENING_BALANCE_EQUITY")

        const accounts = indexOf(await repo.listAllAccounts(orgId, tx))
        const built = buildOpeningBalanceLines({ lines: input.lines, accounts, equityAccountId })
        if (!built.ok) return fromViolation(built.violation)

        return writeEntry(tx, {
          orgId,
          actorId,
          date: input.date,
          description: input.description?.trim() || "Opening balances",
          currency: settings.defaultCurrency,
          status: "POSTED",
          lines: built.value.map((l) => ({ ...l, description: null })),
          source: { type: ACCOUNTING_SOURCE_TYPES.OPENING_BALANCES, id: null, ref: null },
        })
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_JOURNAL_POSTED, actorId, orgId, result.entry.id, {
        entryNumber: result.entry.entryNumber,
        sourceType: ACCOUNTING_SOURCE_TYPES.OPENING_BALANCES,
      })
      return ok({ data: entryDto(result.entry, result.lines), msg: "Opening balances posted successfully" })
    },

    /**
     * Called by the item opening-stock workflow INSIDE its transaction, after the stock ledger posted
     * the movement. `amountMinor` is the value the stock ledger computed; accounting never recomputes
     * it. Dr Inventory, Cr Opening Balance Equity. A zero value posts nothing (an empty entry is not a
     * journal entry). Failures are typed so the caller can roll back everything it wrote.
     */
    async postInventoryOpeningBalance(
      actorId: string | null,
      orgId: string,
      input: PostInventoryOpeningBalanceInput,
      tx: Tx
    ) {
      const amount = parseMinorAmount(input.amountMinor)
      if (amount === null) {
        return fail({
          error: Err.ACCOUNTING_INVALID_AMOUNT,
          msg: "The opening stock value must be a whole number of minor units",
        })
      }
      if (amount === 0n) return ok({ data: { journalEntryId: null as string | null }, msg: "Nothing to post" })

      await repo.lockOrg(orgId, tx)
      const settings = await loadSettings(orgId, tx)
      if (input.currency !== settings.defaultCurrency) {
        return fail({
          error: Err.ACCOUNTING_CURRENCY_MISMATCH,
          msg: `The opening stock is valued in ${input.currency} but the books are kept in ${settings.defaultCurrency}`,
        })
      }

      const mapped = await resolveMapped(orgId, ["INVENTORY_ASSET", "OPENING_BALANCE_EQUITY"], tx)
      if (isFailure(mapped)) return toFail(mapped)

      const lines: CheckedJournalLine[] = []
      for (const l of buildInventoryOpeningTemplate(amount)) {
        const accountId = mapped.get(l.mappingKey)
        if (!accountId) return fail({ error: Err.ACCOUNT_MAPPING_MISSING, msg: `No account is mapped to ${l.mappingKey}` })
        lines.push({
          accountId,
          debit: l.side === "debit" ? l.amount : 0n,
          credit: l.side === "credit" ? l.amount : 0n,
          description: null,
        })
      }

      const written = await writeEntry(tx, {
        orgId,
        actorId,
        date: toBusinessDate(input.postedAt, settings.timezone),
        description: `Opening stock ${input.sourceRef}`,
        currency: settings.defaultCurrency,
        status: "POSTED",
        lines,
        source: { type: input.sourceType, id: input.sourceId, ref: input.sourceRef },
      })
      if (isFailure(written)) return toFail(written)
      return ok({ data: { journalEntryId: written.entry.id as string | null }, msg: "Opening stock posted" })
    },

    /* ---------- automated postings ---------- */

    /**
     * Posts one business event (receipt, invoice, return, adjustment, payment, ...) as a journal
     * entry, with the accounts taken from the organization's mappings. Idempotent on
     * (event type, sourceId): posting the same document twice fails with
     * JOURNAL_ENTRY_DUPLICATE_SOURCE and creates nothing. Pass `tx` to run inside the workflow's
     * own transaction; the workflow owns the audit trail then.
     */
    async postBusinessEvent(actorId: string | null, orgId: string, event: PostBusinessEventInput, tx?: Tx) {
      const result = await inTx(tx, async (t) => {
        await repo.lockOrg(orgId, t)
        const settings = await loadSettings(orgId, t)

        const built = buildPostingTemplate(event)
        if (!built.ok) return failure(built.error, built.msg)
        const { template } = built
        // Every amount was zero: there is nothing to book, and an entry without lines is not one.
        if (template.lines.length === 0) {
          return failure(Err.ACCOUNTING_INVALID_AMOUNT, "The event has no amount to post")
        }

        const mapped = await resolveMapped(orgId, template.lines.map((l) => l.mappingKey), t)
        if (isFailure(mapped)) return mapped

        const checked = checkJournalLines(
          template.lines.map((l) => ({
            accountId: mapped.get(l.mappingKey) ?? "",
            debit: l.side === "debit" ? l.amount.toString() : "0",
            credit: l.side === "credit" ? l.amount.toString() : "0",
          }))
        )
        if (!checked.ok) return failure(checked.error, checked.msg)

        return writeEntry(t, {
          orgId,
          actorId,
          date: event.date,
          description: event.description?.trim() || template.description,
          currency: settings.defaultCurrency,
          status: "POSTED",
          lines: checked.lines,
          source: { type: template.sourceType, id: event.sourceId, ref: event.sourceRef ?? null },
        })
      })
      if (isFailure(result)) return toFail(result)

      if (!tx && actorId) {
        await audit(ActivityLogAction.ACCOUNTING_JOURNAL_POSTED, actorId, orgId, result.entry.id, {
          entryNumber: result.entry.entryNumber,
          sourceType: result.entry.sourceType,
        })
      }
      return ok({ data: entryDto(result.entry, result.lines), msg: "Journal entry posted successfully" })
    },

    /* ---------- accounting periods ---------- */

    async listPeriods(orgId: string) {
      const rows = await repo.listPeriods(orgId)
      return ok({ data: { items: rows.map(toAccountingPeriodDto) } satisfies AccountingPeriodListResponse })
    },

    async createPeriod(actorId: string, orgId: string, input: CreateAccountingPeriodInput) {
      if (input.startDate > input.endDate) {
        return fail({ error: Err.ACCOUNTING_INVALID_DATE_RANGE, msg: "The period must not end before it starts" })
      }
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const overlap = await repo.findOverlappingPeriod(orgId, input.startDate, input.endDate, tx)
        if (overlap) {
          return failure(
            Err.ACCOUNTING_PERIOD_OVERLAP,
            `The period overlaps "${overlap.name}" (${overlap.startDate} to ${overlap.endDate})`
          )
        }
        return repo.insertPeriod(
          { orgId, name: input.name.trim(), startDate: input.startDate, endDate: input.endDate, status: "OPEN" },
          tx
        )
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_PERIOD_CREATED, actorId, orgId, result.id, {
        startDate: result.startDate,
        endDate: result.endDate,
      })
      return ok({ data: toAccountingPeriodDto(result) satisfies AccountingPeriodDto, msg: "Accounting period created" })
    },

    /** OPEN to CLOSED. From then on no entry dated inside the period can be posted or reversed into it. */
    async closePeriod(actorId: string, orgId: string, id: string) {
      const result = await repo.transaction(async (tx) => {
        await repo.lockOrg(orgId, tx)
        const period = await repo.findPeriodById(orgId, id, tx)
        if (!period) return failure(Err.ACCOUNTING_PERIOD_NOT_FOUND, "Accounting period not found")
        if (period.status === "CLOSED") {
          return failure(Err.ACCOUNTING_PERIOD_ALREADY_CLOSED, "The accounting period is already closed")
        }
        const closed = await repo.closePeriod(orgId, id, actorId, now(), tx)
        return closed.ok
          ? closed.row
          : failure(Err.ACCOUNTING_PERIOD_ALREADY_CLOSED, "The accounting period is already closed")
      })
      if (isFailure(result)) return toFail(result)

      await audit(ActivityLogAction.ACCOUNTING_PERIOD_CLOSED, actorId, orgId, id, {
        startDate: result.startDate,
        endDate: result.endDate,
      })
      return ok({ data: toAccountingPeriodDto(result), msg: "Accounting period closed" })
    },

    /* ---------- reports (derived from posted journal lines, never stored) ---------- */

    async getGeneralLedger(orgId: string, query: GeneralLedgerQuery) {
      if (query.from && query.to && query.from > query.to) {
        return fail({ error: Err.ACCOUNTING_INVALID_DATE_RANGE, msg: "The range must not end before it starts" })
      }
      const account = await repo.findAccountById(orgId, query.accountId)
      if (!account) return toFail(accountNotFound())
      const settings = await repo.findOrganizationSettings(orgId)
      if (!settings) throw new Error(`Organization ${orgId} does not exist`)

      const range: LedgerFilter = { accountId: account.id, from: query.from, to: query.to }
      const offset = (query.page - 1) * query.pageSize

      const [totalsByAccount, openingByAccount, total, prefix, rows] = await Promise.all([
        repo.sumByAccount(orgId, range),
        query.from ? repo.sumByAccount(orgId, { accountId: account.id, before: query.from }) : Promise.resolve(null),
        repo.countLedgerLines(orgId, range),
        repo.sumLedgerPrefix(orgId, range, offset),
        repo.listLedgerLines(orgId, range, { limit: query.pageSize, offset }),
      ])
      const opening = openingByAccount?.get(account.id) ?? ZERO_TOTALS
      const inRange = totalsByAccount.get(account.id) ?? ZERO_TOTALS
      const normal = account.normalBalance

      let running = signedBalance(normal, opening.debit + prefix.debit, opening.credit + prefix.credit)
      const lines = rows.map((r) => {
        running += signedBalance(normal, BigInt(r.debit), BigInt(r.credit))
        return {
          entryId: r.entryId,
          entryNumber: r.entryNumber,
          date: r.date,
          description: r.lineDescription ?? r.entryDescription,
          sourceType: r.sourceType,
          sourceRef: r.sourceRef,
          debit: String(r.debit),
          credit: String(r.credit),
          balance: running.toString(),
        }
      })

      return ok({
        data: {
          account: {
            accountId: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            normalBalance: account.normalBalance,
          },
          currency: settings.defaultCurrency,
          from: query.from ?? null,
          to: query.to ?? null,
          openingBalance: signedBalance(normal, opening.debit, opening.credit).toString(),
          closingBalance: signedBalance(normal, opening.debit + inRange.debit, opening.credit + inRange.credit).toString(),
          totalDebit: inRange.debit.toString(),
          totalCredit: inRange.credit.toString(),
          lines,
          page: query.page,
          pageSize: query.pageSize,
          total,
        } satisfies GeneralLedgerResponse,
      })
    },

    async getTrialBalance(orgId: string, query: TrialBalanceQuery) {
      const settings = await repo.findOrganizationSettings(orgId)
      if (!settings) throw new Error(`Organization ${orgId} does not exist`)
      const asOf = query.asOf ?? businessToday(settings.timezone, now())

      const [accounts, totals] = await Promise.all([
        repo.listAllAccounts(orgId),
        repo.sumByAccount(orgId, { to: asOf }),
      ])
      const body = buildTrialBalance(accounts, totals, { includeZero: query.includeZero })
      return ok({ data: { asOf, currency: settings.defaultCurrency, ...body } satisfies TrialBalanceResponse })
    },

    async getProfitAndLoss(orgId: string, query: ProfitAndLossQuery) {
      if (query.from > query.to) {
        return fail({ error: Err.ACCOUNTING_INVALID_DATE_RANGE, msg: "The range must not end before it starts" })
      }
      const settings = await repo.findOrganizationSettings(orgId)
      if (!settings) throw new Error(`Organization ${orgId} does not exist`)

      const [accounts, totals] = await Promise.all([
        repo.listAllAccounts(orgId),
        repo.sumByAccount(orgId, { from: query.from, to: query.to }),
      ])
      const body = buildProfitAndLoss(accounts, totals)
      return ok({
        data: { from: query.from, to: query.to, currency: settings.defaultCurrency, ...body } satisfies ProfitAndLossResponse,
      })
    },

    async getBalanceSheet(orgId: string, query: BalanceSheetQuery) {
      const settings = await repo.findOrganizationSettings(orgId)
      if (!settings) throw new Error(`Organization ${orgId} does not exist`)
      const asOf = query.asOf ?? businessToday(settings.timezone, now())

      const [accounts, totals] = await Promise.all([
        repo.listAllAccounts(orgId),
        repo.sumByAccount(orgId, { to: asOf }),
      ])
      const body = buildBalanceSheet(accounts, totals)
      return ok({ data: { asOf, currency: settings.defaultCurrency, ...body } satisfies BalanceSheetResponse })
    },
  }
}
