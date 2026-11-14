import { sql } from "drizzle-orm"
import {
    check,
    date,
    foreignKey,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    BATCH_DEFAULT_STATUS,
    BATCH_NOTES_MAX_LENGTH,
    BATCH_NUMBER_MAX_LENGTH,
    BATCH_NUMBER_MIN_LENGTH,
    BATCH_STATUSES,
} from "@avuny/contracts/batch"
import { lengthBetween, pk, timestamps } from "../_helpers.js"
import { items, orgRef, shelfLifeUnitEnum } from "../index.js"
// Adjust to where the items table lives.


export const batchStatusEnum = pgEnum("batch_status", BATCH_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * BATCHES: a lot of one item, identified by the number printed on the goods, with its dates and
 * its operational status (available, quarantined, blocked, recalled).
 * Flow: created when stock of a batch-tracked item first arrives (opening stock, a purchase receipt,
 * a production output) through the batch service; the stock movement lines and balances then point
 * at it. Batches are never deleted: a lot that is withdrawn is recalled or blocked, and its history
 * stays readable.
 * Integrity: composite FK (org_id, item_id) keeps the batch inside the item's organization; the
 * number is unique per item, case-insensitively; (org_id, item_id, id) is the FK target for stock
 * rows, so a stock row can never name a batch of another item or organization; the expiry date is not
 * before the manufacturing date; the number is trimmed and within its length bounds.
 * Not expressible here: that the item is batch tracked, which statuses allow which stock postings
 * (batchAllowsIntent in contracts, applied by the stock movement service), and expiry handling
 * (picking order, blocking expired stock), which belongs to allocation.
 */
export const batches = pgTable(
    "batches",
    {
        id: pk(),
        orgId: orgRef(),
        itemId: uuid("item_id").notNull(),
        batchNumber: text("batch_number").notNull(),
        manufacturedOn: date("manufactured_on", { mode: "string" }),
        expiresOn: date("expires_on", { mode: "string" }),
        shelfLifeValue: integer("shelf_life_value"),
        shelfLifeUnit: shelfLifeUnitEnum("shelf_life_unit"),
        status: batchStatusEnum("status").notNull().default(BATCH_DEFAULT_STATUS),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_batch_org_item_id").on(t.orgId, t.itemId, t.id), // FK target for stock movement lines and balances
        foreignKey({
            name: "fk_batch_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_batch_org_item_number").on(t.orgId, t.itemId, sql`lower(${t.batchNumber})`),
        index("ix_batch_org_item_status_expiry").on(t.orgId, t.itemId, t.status, t.expiresOn),
        index("ix_batch_org_expiry").on(t.orgId, t.expiresOn).where(sql`${t.expiresOn} is not null`),
        check(
            "ck_batch_number_len",
            lengthBetween(t.batchNumber, BATCH_NUMBER_MIN_LENGTH, BATCH_NUMBER_MAX_LENGTH)
        ),
        check("ck_batch_number_trimmed", sql`${t.batchNumber} = btrim(${t.batchNumber})`),
        check(
            "ck_batch_dates",
            sql`${t.manufacturedOn} is null or ${t.expiresOn} is null or ${t.expiresOn} >= ${t.manufacturedOn}`
        ),
        check(
            "ck_batch_shelf_life_unit_and_value",
            sql`(${t.shelfLifeValue} IS NULL AND ${t.shelfLifeUnit} IS NULL) OR (${t.shelfLifeValue} IS NOT NULL AND ${t.shelfLifeUnit} IS NOT NULL)`
        ),
        check(
            "ck_batch_shelf_life_positive_value",
            sql`${t.shelfLifeValue} IS NULL OR ${t.shelfLifeValue} > 0`
        ),
        check(
            "ck_batch_notes_len",
            sql`${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(BATCH_NOTES_MAX_LENGTH)}`
        ),
    ]
)
export type Batch = typeof batches.$inferSelect
export type NewBatch = typeof batches.$inferInsert
