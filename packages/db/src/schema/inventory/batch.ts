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

export const batchStatusEnum = pgEnum("batch_status", BATCH_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * BATCHES: permanent master records identifying a particular lot of an item.
 * Flow: created by the Batch Service when an item first receives a batch through opening stock,
 * purchasing, or production; stock movements and location-level batch balances then reference it.
 * One batch belongs to one organization and item, but the same batch may exist in multiple
 * inventory locations. A location may also contain multiple batches of the same item.
 * Integrity: composite FK to items; unique case-insensitive batch number per organization/item;
 * unique (org_id, item_id, id) target for stock and inventory references; trimmed/length-bounded
 * batch number; valid manufacturing/expiry dates; paired shelf-life value/unit; positive shelf life.
 * Batches are permanent: zero quantity, blocked, recalled, expired, and quarantined batches remain
 * readable. This table deliberately has no quantity or cost column; location quantities belong to
 * inventory_item_batches and valuation belongs to the costing/accounting model.
 * Not expressible here: whether the item is batch tracked, whether a batch status allows a posting,
 * batch allocation/picking policy, expiry enforcement, or physical batch quantity aggregation.
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
        unique("ux_batch_org_item_id").on(t.orgId, t.itemId, t.id),
        foreignKey({
            name: "fk_batch_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_batch_org_item_number").on(t.orgId, t.itemId, sql`lower(${t.batchNumber})`),
        index("ix_batch_org_item_status_expiry").on(t.orgId, t.itemId, t.status, t.expiresOn),
        index("ix_batch_org_expiry")
            .on(t.orgId, t.expiresOn)
            .where(sql`${t.expiresOn} is not null`),
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
            sql`(${t.shelfLifeValue} is null and ${t.shelfLifeUnit} is null)
                or (${t.shelfLifeValue} is not null and ${t.shelfLifeUnit} is not null)`
        ),
        check(
            "ck_batch_shelf_life_positive_value",
            sql`${t.shelfLifeValue} is null or ${t.shelfLifeValue} > 0`
        ),
        check(
            "ck_batch_notes_len",
            sql`${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(BATCH_NOTES_MAX_LENGTH)}`
        ),
    ]
)

export type Batch = typeof batches.$inferSelect
export type NewBatch = typeof batches.$inferInsert
