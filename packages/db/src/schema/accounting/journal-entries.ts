import { sql } from "drizzle-orm"
import {
    check,
    date,
    foreignKey,
    index,
    integer,
    pgEnum,
    pgTable,
    smallint,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    ACCOUNTING_MAX_MINOR_AMOUNT,
    JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH,
    JOURNAL_ENTRY_NUMBER_REGEX,
    JOURNAL_ENTRY_SOURCE_REF_MAX_LENGTH,
    JOURNAL_ENTRY_SOURCE_TYPE_MAX_LENGTH,
    JOURNAL_ENTRY_STATUSES,
    JOURNAL_LINE_DESCRIPTION_MAX_LENGTH,
} from "@avuny/contracts/accounting"
import { currency, isCurrency, matchesRegex, money, pk, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { accounts } from "./accounts.js"

export const journalEntryStatusEnum = pgEnum("journal_entry_status", JOURNAL_ENTRY_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * JOURNAL_ENTRIES: the header of one double-entry transaction: a manual entry, an opening balance,
 * or the posting of a business event (opening stock, a goods receipt, a sale, a payment, ...).
 * Flow: a manual entry starts as DRAFT and is POSTED by a second call; automated postings are
 * created POSTED in the caller's transaction, so a business document and its journal commit or fail
 * together. A posted entry is never edited or deleted: a mistake is corrected by posting a reversal
 * (reversal_of_id), which swaps debit and credit on every line, and the original becomes REVERSED.
 * Reports read lines of POSTED and REVERSED entries; drafts never count.
 * Integrity: (org_id, id) is the FK target for the lines; a reversal points at an entry of the same
 * organization (composite self FK) and never at itself; an entry can be reversed once (partial
 * unique index, which also settles two concurrent reversals); an automated posting for one source
 * document and source type exists once (partial unique index, reversals excluded), which makes a
 * retried posting idempotent; the entry number and its sequence are unique per organization; the
 * number format, the currency format and the text lengths are checked; posted_at is set exactly
 * when the entry has left DRAFT; source_id needs source_type.
 * Not expressible here: that the entry balances and has at least two lines (lines are separate
 * rows, so the accounting service checks it before the entry is written), that the date is not in a
 * closed accounting period, that the currency is the organization's, that a reversal has the
 * original's lines swapped, that a posted entry and its lines are never updated or deleted, and
 * created_by / posted_by (the users table is global, so there is no composite FK for them).
 */
export const journalEntries = pgTable(
    "journal_entries",
    {
        id: pk(),
        orgId: orgRef(),
        entrySeq: integer("entry_seq").notNull(),
        entryNumber: text("entry_number").notNull(),
        date: date("entry_date", { mode: "string" }).notNull(),
        description: text("description"),
        status: journalEntryStatusEnum("status").notNull().default("DRAFT"),
        currency: currency(),
        sourceType: text("source_type"),
        sourceId: uuid("source_id"),
        sourceRef: text("source_ref"),
        reversalOfId: uuid("reversal_of_id"),
        createdBy: uuid("created_by"),
        postedAt: timestamptz("posted_at"),
        postedBy: uuid("posted_by"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_journal_entry_org_id").on(t.orgId, t.id), // FK target for lines
        uniqueIndex("ux_journal_entry_org_seq").on(t.orgId, t.entrySeq),
        uniqueIndex("ux_journal_entry_org_number").on(t.orgId, t.entryNumber),
        foreignKey({
            name: "fk_journal_entry_reversal_of",
            columns: [t.orgId, t.reversalOfId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_journal_entry_org_source")
            .on(t.orgId, t.sourceType, t.sourceId)
            .where(sql`${t.sourceId} is not null and ${t.reversalOfId} is null`),
        uniqueIndex("ux_journal_entry_org_reversal")
            .on(t.orgId, t.reversalOfId)
            .where(sql`${t.reversalOfId} is not null`),
        index("ix_journal_entry_org_status_date").on(t.orgId, t.status, t.date), // reports
        index("ix_journal_entry_org_date").on(t.orgId, t.date),
        check("ck_journal_entry_number_fmt", matchesRegex(t.entryNumber, JOURNAL_ENTRY_NUMBER_REGEX.source)),
        check("ck_journal_entry_seq", sql`${t.entrySeq} >= 1`),
        check("ck_journal_entry_currency", isCurrency(t.currency)),
        check("ck_journal_entry_source", sql`${t.sourceId} is null or ${t.sourceType} is not null`),
        check("ck_journal_entry_not_self_reversal", sql`${t.reversalOfId} is null or ${t.reversalOfId} <> ${t.id}`),
        check(
            "ck_journal_entry_posted",
            sql`(${t.status} = 'DRAFT' and ${t.postedAt} is null and ${t.postedBy} is null) or (${t.status} <> 'DRAFT' and ${t.postedAt} is not null)`
        ),
        check(
            "ck_journal_entry_text_len",
            sql`(${t.description} is null or char_length(${t.description}) <= ${sqlNum(JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH)})
                and (${t.sourceType} is null or char_length(${t.sourceType}) <= ${sqlNum(JOURNAL_ENTRY_SOURCE_TYPE_MAX_LENGTH)})
                and (${t.sourceRef} is null or char_length(${t.sourceRef}) <= ${sqlNum(JOURNAL_ENTRY_SOURCE_REF_MAX_LENGTH)})`
        ),
    ]
)
export type JournalEntry = typeof journalEntries.$inferSelect
export type NewJournalEntry = typeof journalEntries.$inferInsert

/**
 * JOURNAL_ENTRY_LINES: one debit or one credit of an entry, against one account.
 * Flow: written by the accounting service together with its header, in one transaction. Amounts are
 * integer minor units in the entry's currency (money(), bigint), exactly one of debit and credit is
 * positive on a line, and totals are always summed as BigInt.
 * Integrity: composite FKs keep the entry and the account inside the organization (restrict, so an
 * account with history cannot be deleted); line numbers are unique per entry; both amounts are
 * non-negative and below the storable maximum; exactly one side is positive; the description length
 * is checked; an index serves the general ledger and the reports of one account.
 * Not expressible here: that the lines of an entry balance, that the account allows posting and is
 * active, and that lines of a posted entry never change (accounting service).
 */
export const journalEntryLines = pgTable(
    "journal_entry_lines",
    {
        id: pk(),
        orgId: orgRef(),
        journalEntryId: uuid("journal_entry_id").notNull(),
        lineNo: smallint("line_no").notNull(),
        accountId: uuid("account_id").notNull(),
        description: text("description"),
        debit: money("debit").default(0),
        credit: money("credit").default(0),
        ...timestamps(),
    },
    (t) => [
        unique("ux_journal_entry_line_no").on(t.journalEntryId, t.lineNo),
        foreignKey({
            name: "fk_journal_entry_line_entry",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_journal_entry_line_account",
            columns: [t.orgId, t.accountId],
            foreignColumns: [accounts.orgId, accounts.id],
        }).onDelete("restrict"),
        index("ix_journal_entry_line_entry").on(t.orgId, t.journalEntryId),
        index("ix_journal_entry_line_account").on(t.orgId, t.accountId),
        check("ck_journal_entry_line_no", sql`${t.lineNo} >= 1`),
        check(
            "ck_journal_entry_line_amount_max",
            sql`${t.debit} >= 0 and ${t.credit} >= 0 and ${t.debit} <= ${sqlNum(ACCOUNTING_MAX_MINOR_AMOUNT)} and ${t.credit} <= ${sqlNum(ACCOUNTING_MAX_MINOR_AMOUNT)}`
        ),
        check("ck_journal_entry_line_one_side", sql`(${t.debit} > 0) <> (${t.credit} > 0)`),
        check(
            "ck_journal_entry_line_text_len",
            sql`${t.description} is null or char_length(${t.description}) <= ${sqlNum(JOURNAL_LINE_DESCRIPTION_MAX_LENGTH)}`
        ),
    ]
)
export type JournalEntryLine = typeof journalEntryLines.$inferSelect
export type NewJournalEntryLine = typeof journalEntryLines.$inferInsert
