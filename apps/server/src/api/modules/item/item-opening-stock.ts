import {
  InventoryCostingErrorCode,
  inventoryCostingTranslationsEn,
  ITEM_OPENING_STOCK_SOURCE_TYPE,
  STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH,
  batchNumberKey,
  type AccountingErrorCode,
  type BatchSpec,
  type PostInventoryOpeningBalanceInput,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { BatchService } from "../batch/index.js"
import type { InventoryCostingService } from "../inventory-costing/index.js"
import type { StockMovementService } from "../stock-movement/index.js"
import type { NormalizedOpeningLine } from "./item-opening-stock.rules.js"
import { seedInventoryDefaults } from "../warehouse/warehouse.defaults.js"

export function generateBatchNumber(index?: number): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return index !== undefined ? `BAT-${today}-${rand}-${index}` : `BAT-${today}-${rand}`
}

/** Ports the item service needs to post opening stock (declared here, wired lazily in deps.ts). */
export interface ItemOpeningStockDeps {
  stockMovements: Pick<StockMovementService, "post">
  batches: Pick<BatchService, "ensureBatches">
  findOrgCurrency?: (orgId: string, tx: Tx) => Promise<string | null>
  inventoryCosting?: {
    service: Pick<InventoryCostingService, "createCostLayer">
    /** Look up inventory item id by (orgId, itemId, locationId). Returns null if not found yet. */
    findInventoryItemId(orgId: string, itemId: string, locationId: string, tx: Tx): Promise<string | null>
    /** Look up inventory item batch id by (orgId, inventoryItemId, batchId). Returns null if not found. */
    findInventoryItemBatchId(orgId: string, inventoryItemId: string, batchId: string, tx: Tx): Promise<string | null>
  }
  accounting?: {
    postInventoryOpeningBalance(
      actorId: string | null,
      orgId: string,
      input: PostInventoryOpeningBalanceInput,
      tx: Tx
    ): Promise<Result<{ journalEntryId: string | null }, AccountingErrorCode>>
    initializeChartOfAccounts?(orgId: string, tx: Tx): Promise<unknown>
  }
}

type OpeningStock = { lines: NormalizedOpeningLine[] }

/**
 * Creates the batches of a new item and posts its opening stock, inside the caller's transaction.
 * The batches are written before the stock is checked, so a failure here leaves rows behind in
 * that transaction: the item service must roll it back (abort) when this returns ok: false.
 */
export async function postOpeningStock(
  deps: ItemOpeningStockDeps,
  args: {
    tx: Tx
    actorId: string
    orgId: string
    itemId: string
    itemName: string
    isBatchTracked: boolean
    opening: OpeningStock
  }
): Promise<{ ok: true } | { ok: false; error?: string; msg: string }> {
  const { tx, actorId, orgId, itemId, itemName, isBatchTracked, opening } = args

  // One batch per distinct number; the same lot can be stocked in several locations.
  const batchIdByKey = new Map<string, string>()
  const lineBatchNumbers: string[] = []

  if (isBatchTracked) {
    const specs: BatchSpec[] = []
    for (const [index, line] of opening.lines.entries()) {
      const batchNumber = line.batch?.number?.trim() || generateBatchNumber(index + 1)
      lineBatchNumbers.push(batchNumber)
      specs.push({
        number: batchNumber,
        manufacturedOn: line.manufacturedOn ?? line.batch?.manufacturedOn ?? null,
        expiresOn: line.batch?.expiresOn ?? null,
        shelfLifeValue: line.batch?.shelfLifeValue,
        shelfLifeUnit: line.batch?.shelfLifeUnit,
        notes: line.batch?.notes,
      })
    }
    const ensured = await deps.batches.ensureBatches(orgId, itemId, specs, tx)
    if (!ensured.success) return { ok: false, error: ensured.error, msg: ensured.msg }
    for (const batch of ensured.data) batchIdByKey.set(batchNumberKey(batch.batchNumber), batch.id)
  }

  // One stock movement per distinct posting date. The item is the source document of the first one
  // (opening stock is posted once per item); later dates use their own source id.
  const groups = new Map<string, number[]>()
  for (const [index, line] of opening.lines.entries()) {
    const group = groups.get(line.postedAt)
    if (group) group.push(index)
    else groups.set(line.postedAt, [index])
  }

  // Cost is required on every opening line (inventory-costing R1). A missing cost never turns into
  // zero. An explicit zero is accepted and recorded as a zero-cost layer with reason OTHER.
  for (const line of opening.lines) {
    if (line.cost === null || line.cost === undefined || String(line.cost).trim() === "") {
      return {
        ok: false,
        error: InventoryCostingErrorCode.STOCK_MOVEMENT_COST_REQUIRED,
        msg: inventoryCostingTranslationsEn.errors.STOCK_MOVEMENT_COST_REQUIRED,
      }
    }
  }

  // Resolve organization currency (needed for cost layers and accounting)
  const currency = (deps.findOrgCurrency ? await deps.findOrgCurrency(orgId, tx) : null) ?? "USD"

  let groupNumber = 0
  for (const [postedAt, indexes] of groups) {
    const sourceId = groupNumber === 0 ? itemId : crypto.randomUUID()
    groupNumber += 1
    const groupLines = indexes.map((i) => opening.lines[i]!)

    const postPayload = {
      type: "opening" as const,
      postedAt,
      sourceType: ITEM_OPENING_STOCK_SOURCE_TYPE,
      sourceId,
      sourceRef: itemName.slice(0, STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH),
      lines: indexes.map((i) => ({
        itemId,
        batchId: isBatchTracked ? (batchIdByKey.get(batchNumberKey(lineBatchNumbers[i]!)) ?? null) : null,
        toLocationId: opening.lines[i]!.locationId,
        quantity: opening.lines[i]!.quantity,
        // The exact line value, the same number the journal uses (no base-unit rounding).
        cost: {
          source: "DOCUMENT" as const,
          totalValueMinor: opening.lines[i]!.valueMinor.toString(),
          ...(opening.lines[i]!.valueMinor === 0n ? { zeroCost: { reason: "OTHER" as const } } : {}),
        },
      })),
    }

    let posted = await deps.stockMovements.post(actorId, orgId, postPayload, tx)
    if (!posted.success && posted.error === "STOCK_MOVEMENT_SYSTEM_LOCATION_MISSING") {
      try {
        await seedInventoryDefaults(tx, orgId)
        posted = await deps.stockMovements.post(actorId, orgId, postPayload, tx)
      } catch {
        // Best-effort auto-seeding
      }
    }
    if (!posted.success) return { ok: false, error: posted.error, msg: posted.msg }

    // The cost layers are written by the stock movement, from the line costs (inventory-costing 2c).

    // Post opening inventory to accounting: Dr Inventory Asset, Cr Opening Balance Equity
    if (deps.accounting) {
      const totalValueMinor = groupLines.reduce((sum, l) => sum + l.valueMinor, 0n)
      const accountingInput: PostInventoryOpeningBalanceInput = {
        sourceType: ITEM_OPENING_STOCK_SOURCE_TYPE,
        sourceId,
        sourceRef: itemName.slice(0, STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH),
        postedAt,
        amountMinor: totalValueMinor.toString(),
        currency,
      }

      let accountingResult = await deps.accounting.postInventoryOpeningBalance(
        actorId,
        orgId,
        accountingInput,
        tx
      )

      if (
        !accountingResult.success &&
        accountingResult.error === "ACCOUNT_MAPPING_MISSING" &&
        deps.accounting.initializeChartOfAccounts
      ) {
        try {
          await deps.accounting.initializeChartOfAccounts(orgId, tx)
          accountingResult = await deps.accounting.postInventoryOpeningBalance(
            actorId,
            orgId,
            accountingInput,
            tx
          )
        } catch {
          // Best-effort auto-seeding
        }
      }

      if (!accountingResult.success) {
        return { ok: false, error: accountingResult.error, msg: accountingResult.msg }
      }
    }
  }

  return { ok: true }
}
