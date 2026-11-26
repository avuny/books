import type {
  AccountDto,
  AccountingPeriodDto,
  AccountMappingDto,
  JournalEntryDto,
  JournalEntryLineDto,
  JournalEntryListItemDto,
} from "@avuny/contracts"
import type { Account, AccountingPeriod, JournalEntryLine } from "@avuny/db"
import type { AccountMappingRow, JournalEntryView } from "./accounting.repository.js"

export function toAccountDto(row: Account): AccountDto {
  return {
    id: row.id,
    orgId: row.orgId,
    code: row.code,
    name: row.name,
    description: row.description,
    type: row.type,
    normalBalance: row.normalBalance,
    parentId: row.parentId,
    systemKey: row.systemKey,
    isSystem: row.systemKey !== null,
    isActive: row.isActive,
    allowPosting: row.allowPosting,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toAccountMappingDto(row: AccountMappingRow): AccountMappingDto {
  return {
    key: row.mapping.mappingKey,
    accountId: row.account.id,
    accountCode: row.account.code,
    accountName: row.account.name,
    updatedAt: row.mapping.updatedAt.toISOString(),
  }
}

export function toJournalEntryLineDto(row: JournalEntryLine): JournalEntryLineDto {
  return {
    id: row.id,
    lineNo: row.lineNo,
    accountId: row.accountId,
    description: row.description,
    debit: String(row.debit),
    credit: String(row.credit),
  }
}

/** Header fields shared by the list item and the full entry. Dates stay business dates (YYYY-MM-DD). */
export function toJournalEntryListItemDto(view: JournalEntryView): JournalEntryListItemDto {
  const { entry } = view
  return {
    id: entry.id,
    orgId: entry.orgId,
    entryNumber: entry.entryNumber,
    date: entry.date,
    description: entry.description,
    status: entry.status,
    currency: entry.currency,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    sourceRef: entry.sourceRef,
    reversalOfId: entry.reversalOfId,
    reversedById: view.reversedById,
    totalDebit: view.totalDebit,
    totalCredit: view.totalCredit,
    createdBy: entry.createdBy,
    postedAt: entry.postedAt ? entry.postedAt.toISOString() : null,
    postedBy: entry.postedBy,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

export function toJournalEntryDto(
  view: JournalEntryView,
  lines: readonly JournalEntryLine[]
): JournalEntryDto {
  return {
    ...toJournalEntryListItemDto(view),
    lines: lines.map(toJournalEntryLineDto),
  }
}

export function toAccountingPeriodDto(row: AccountingPeriod): AccountingPeriodDto {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedBy: row.closedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

