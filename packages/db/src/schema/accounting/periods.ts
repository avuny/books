import { sql } from "drizzle-orm"
import { check, date, index, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core"
import {
    ACCOUNTING_PERIOD_NAME_MAX_LENGTH,
    ACCOUNTING_PERIOD_NAME_MIN_LENGTH,
    ACCOUNTING_PERIOD_STATUSES,
} from "@avuny/contracts/accounting"
import { lengthBetween, pk, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"

export const accountingPeriodStatusEnum = pgEnum("accounting_period_status", ACCOUNTING_PERIOD_STATUSES)

/**
 * ACCOUNTING_PERIODS: a date range of one organization's books (a month, a quarter, a year) that can
 * be closed.
 * Flow: an accountant creates the periods, and closes one when its books are final. From then on a
 * journal entry dated inside a closed period is rejected (JOURNAL_ENTRY_PERIOD_CLOSED), whether it is
 * manual, automated or a reversal. A date outside every period is open by default, so an
 * organization that never creates a period can still post.
 * Integrity: the range is valid (start on or before end, both inclusive); closed_at is set exactly
 * when the period is CLOSED; names are length checked; (org_id, id) is a FK target; an index serves
 * the "which period contains this date" lookup done on every posting.
 * Not expressible here: that two periods of one organization never overlap (that needs a btree_gist
 * exclusion constraint, which drizzle cannot declare; the service checks it under the organization
 * lock), that a closed period is never reopened or edited, and closed_by (the users table is
 * global, so there is no composite FK for it).
 */
export const accountingPeriods = pgTable(
    "accounting_periods",
    {
        id: pk(),
        orgId: orgRef(),
        name: text("name").notNull(),
        startDate: date("start_date", { mode: "string" }).notNull(),
        endDate: date("end_date", { mode: "string" }).notNull(),
        status: accountingPeriodStatusEnum("status").notNull().default("OPEN"),
        closedAt: timestamptz("closed_at"),
        closedBy: uuid("closed_by"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_accounting_period_org_id").on(t.orgId, t.id),
        index("ix_accounting_period_org_dates").on(t.orgId, t.startDate, t.endDate),
        check(
            "ck_accounting_period_name_len",
            lengthBetween(t.name, ACCOUNTING_PERIOD_NAME_MIN_LENGTH, ACCOUNTING_PERIOD_NAME_MAX_LENGTH)
        ),
        check("ck_accounting_period_range", sql`${t.startDate} <= ${t.endDate}`),
        check(
            "ck_accounting_period_closed",
            sql`(${t.status} = 'CLOSED' and ${t.closedAt} is not null) or (${t.status} = 'OPEN' and ${t.closedAt} is null and ${t.closedBy} is null)`
        ),
    ]
)
export type AccountingPeriod = typeof accountingPeriods.$inferSelect
export type NewAccountingPeriod = typeof accountingPeriods.$inferInsert
