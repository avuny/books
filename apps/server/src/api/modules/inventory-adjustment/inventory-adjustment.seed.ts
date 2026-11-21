import { notInArray, sql } from "drizzle-orm"
import {
  SYSTEM_INVENTORY_ADJUSTMENT_REASONS,
  type SystemInventoryAdjustmentReason,
} from "@avuny/contracts"
import { inventoryAdjustmentReasons, type DB } from "@avuny/db"

export interface SeedInventoryAdjustmentReasonsSummary {
  reasonsUpserted: number
  reasonsRemoved: number
}

/**
 * Idempotent & synchronizing: safe to run on every deploy or manually.
 * Takes its data from @avuny/contracts (SYSTEM_INVENTORY_ADJUSTMENT_REASONS).
 * - Upserts seeded system reasons (org_id is null, is_system is true) by unique `code`.
 * - Removes system reasons in the database that are no longer in the registry.
 */
export async function seedInventoryAdjustmentReasons({
  db,
  definitions = SYSTEM_INVENTORY_ADJUSTMENT_REASONS,
}: {
  db: DB
  definitions?: readonly SystemInventoryAdjustmentReason[]
}): Promise<SeedInventoryAdjustmentReasonsSummary> {
  let reasonsUpserted = 0
  let reasonsRemoved = 0

  const targetCodes = definitions.map((r) => r.code)

  await db.transaction(async (tx) => {
    // 1. Delete system reasons removed from contracts (if any)
    if (targetCodes.length > 0) {
      const deleted = await tx
        .delete(inventoryAdjustmentReasons)
        .where(
          sql`${inventoryAdjustmentReasons.orgId} is null and ${inventoryAdjustmentReasons.isSystem} = true and ${notInArray(
            inventoryAdjustmentReasons.code,
            targetCodes
          )}`
        )
        .returning({ id: inventoryAdjustmentReasons.id })
      reasonsRemoved = deleted.length
    }

    // 2. Upsert system reasons from contracts
    for (const reason of definitions) {
      const now = new Date()
      await tx
        .insert(inventoryAdjustmentReasons)
        .values({
          code: reason.code,
          name: reason.nameEn,
          direction: reason.direction,
          isSystem: true,
          isActive: true,
          sortOrder: reason.sortOrder,
          orgId: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: inventoryAdjustmentReasons.code,
          targetWhere: sql`${inventoryAdjustmentReasons.orgId} is null`,
          set: {
            name: reason.nameEn,
            direction: reason.direction,
            isSystem: true,
            isActive: true,
            sortOrder: reason.sortOrder,
            updatedAt: now,
          },
        })
      reasonsUpserted++
    }
  })

  return { reasonsUpserted, reasonsRemoved }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("inventory-adjustment.seed.ts")
) {
  const { db } = await import("../../db.js")
  console.log("Seeding inventory adjustment reasons...")
  const result = await seedInventoryAdjustmentReasons({ db })
  console.log(
    `Seeded inventory adjustment reasons: ${result.reasonsUpserted} upserted, ${result.reasonsRemoved} removed.`
  )
  process.exit(0)
}
