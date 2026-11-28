import { and, eq } from "drizzle-orm"
import { inventoryItemBatches, inventoryItems, organizations } from "@avuny/db"
import { db } from "../../db.js"
import { getInventoryCostingService } from "../inventory-costing/index.js"
import { getInventoryCostingRepository, getValuationEngine } from "../inventory-costing/deps.js"
import { getBatchService } from "../batch/index.js"
// Adjust to the names the item and warehouse-location barrels export.
import { getItemRepository } from "../item/index.js"
import { getWarehouseLocationService } from "../warehouse-location/index.js"
import { createStockMovementRepository } from "./stock-movement.repository.js"
import { createStockMovementService } from "./stock-movement.service.js"
import type { StockMovementRepository, StockMovementService } from "./stock-movement.types.js"

let _repo: StockMovementRepository | undefined
let _service: StockMovementService | undefined

export function getStockMovementRepository(): StockMovementRepository {
  return (_repo ??= createStockMovementRepository({ db }))
}

export function getStockMovementService(): StockMovementService {
  return (_service ??= createStockMovementService({
    repository: getStockMovementRepository(),
    // The same gate every posting module uses; resolved lazily to avoid an import cycle.
    locations: {
      assertPostable: (orgId, locationId, intent, tx) =>
        getWarehouseLocationService().assertPostable(orgId, locationId, intent, tx),
    },
    batches: {
      findForPosting: (orgId, batchIds, tx) => getBatchService().findForPosting(orgId, batchIds, tx),
      listAllocatable: (orgId, itemId, locationId, tx) =>
        getBatchService().listAllocatable(orgId, itemId, locationId, tx),
    },
    // Costs value-in lines through the valuation engine. The engine is built lazily, like the others.
    costing: {
      async isWeightedAverage(orgId, itemId, tx) {
        return (await getInventoryCostingRepository().findValuationMethod(orgId, itemId, tx)) === "WAC"
      },
      async issueLine(line, tx) {
        let currency = line.currency
        if (!currency) {
          const [org] = await tx
            .select({ currency: organizations.defaultCurrency })
            .from(organizations)
            .where(eq(organizations.id, line.orgId))
            .limit(1)
          currency = org?.currency ?? "USD"
        }
        const res = await getValuationEngine().issue(
          {
            method: "WAC",
            orgId: line.orgId,
            inventoryItemId: "",
            inventoryItemBatchId: null,
            outgoingMovementLineId: line.movementLineId,
            quantity: line.quantity,
            itemId: line.itemId,
            currency,
            effectiveAt: line.postedAt,
          },
          tx
        )
        return res.ok ? { ok: true } : { ok: false, error: res.error, msg: res.msg }
      },
      async reverseLine(line, tx) {
        const original = await getInventoryCostingRepository().findEntryByMovementLine(
          line.orgId,
          line.reversesMovementLineId,
          tx
        )
        if (!original) {
          return {
            ok: false,
            error: "COST_SOURCE_NOT_FOUND" as const,
            msg: "The cost entry of the movement line being reversed was not found",
          }
        }
        const res = await getValuationEngine().reverseWac(
          {
            orgId: line.orgId,
            itemId: line.itemId,
            movementLineId: line.movementLineId,
            reversesEntryId: original.id,
            quantity: line.quantity,
            currency: original.currency,
            effectiveAt: line.postedAt,
          },
          tx
        )
        return res.ok ? { ok: true } : { ok: false, error: res.error, msg: res.msg }
      },
      async moveLine(line, tx) {
        const find = async (locationId: string) => {
          const [inv] = await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.orgId, line.orgId),
                eq(inventoryItems.itemId, line.itemId),
                eq(inventoryItems.locationId, locationId)
              )
            )
            .limit(1)
          if (!inv) throw new Error("Inventory item row missing after stock lock")
          let batchRowId: string | null = null
          if (line.batchId) {
            const [b] = await tx
              .select({ id: inventoryItemBatches.id })
              .from(inventoryItemBatches)
              .where(
                and(
                  eq(inventoryItemBatches.orgId, line.orgId),
                  eq(inventoryItemBatches.inventoryItemId, inv.id),
                  eq(inventoryItemBatches.batchId, line.batchId)
                )
              )
              .limit(1)
            batchRowId = b?.id ?? null
          }
          return { inventoryItemId: inv.id, batchRowId }
        }
        const from = await find(line.fromLocationId)
        const to = await find(line.toLocationId)
        const engine = getValuationEngine()
        const res = await engine.move(
          {
            method: (await getInventoryCostingRepository().findValuationMethod(line.orgId, line.itemId, tx)) === "WAC" ? "WAC" : "FIFO",
            orgId: line.orgId,
            fromInventoryItemId: from.inventoryItemId,
            fromBatchId: from.batchRowId,
            toInventoryItemId: to.inventoryItemId,
            toBatchId: to.batchRowId,
            itemId: line.itemId,
            movementLineId: line.movementLineId,
            quantity: line.quantity,
            strict: line.strict,
          },
          tx
        )
        return res.ok ? { ok: true } : { ok: false, error: res.error, msg: res.msg }
      },
      async receiveLine(line, tx) {
        const [inv] = await tx
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.orgId, line.orgId),
              eq(inventoryItems.itemId, line.itemId),
              eq(inventoryItems.locationId, line.toLocationId)
            )
          )
          .limit(1)
        if (!inv) throw new Error("Inventory item row missing after stock lock")
        let inventoryItemBatchId: string | null = null
        if (line.batchId) {
          const [b] = await tx
            .select({ id: inventoryItemBatches.id })
            .from(inventoryItemBatches)
            .where(
              and(
                eq(inventoryItemBatches.orgId, line.orgId),
                eq(inventoryItemBatches.inventoryItemId, inv.id),
                eq(inventoryItemBatches.batchId, line.batchId)
              )
            )
            .limit(1)
          inventoryItemBatchId = b?.id ?? null
        }
        let currency = line.currency
        if (!currency) {
          const [org] = await tx
            .select({ currency: organizations.defaultCurrency })
            .from(organizations)
            .where(eq(organizations.id, line.orgId))
            .limit(1)
          currency = org?.currency ?? "USD"
        }
        const engine = getValuationEngine()
        const res = await engine.receive(
          {
            method: (await getInventoryCostingRepository().findValuationMethod(line.orgId, line.itemId, tx)) === "WAC" ? "WAC" : "FIFO",
            orgId: line.orgId,
            inventoryItemId: inv.id,
            itemId: line.itemId,
            inventoryItemBatchId,
            sourceMovementLineId: line.movementLineId,
            quantity: line.quantity,
            currency,
            receivedAt: line.receivedAt,
            cost: line.cost,
          },
          tx
        )
        return res.ok ? { ok: true } : { ok: false, error: res.error, msg: res.msg }
      },
    },
    // See ITEM_CHANGES.md: findStockPolicies is a small query to add to the item repository.
    items: {
      findPolicies: (orgId, itemIds, tx) => getItemRepository().findStockPolicies(orgId, itemIds, tx),
    },
  }))
}

export const stockMovementService = new Proxy({} as StockMovementService, {
  get(_target, prop) {
    return (getStockMovementService() as any)[prop]
  },
})
