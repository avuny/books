import type { CreateItemInput } from "@avuny/contracts"
import { ItemErrorCode as Err } from "./item.errors.js"

export type OpeningStockViolation = { error: Err; msg: string }

/**
 * Pure checks of the opening stock on a new item, run before anything is written.
 * - opening stock needs an inventory-tracked item;
 * - a batch-tracked item needs batch details on every line, and any other item must have none.
 * Quantities, locations and batch dates are checked by the stock and batch modules when posting.
 */
export function checkOpeningStock(
  input: Pick<CreateItemInput, "isInventoryTracked" | "isBatchTracked" | "openingStock">
): OpeningStockViolation | null {
  if (!input.openingStock) return null
  if (!input.isInventoryTracked) {
    return { error: Err.ITEM_OPENING_STOCK_NOT_TRACKED, msg: "Opening stock needs an inventory-tracked item" }
  }
  for (const [index, line] of input.openingStock.lines.entries()) {
    if (input.isBatchTracked && !line.batch) {
      return {
        error: Err.ITEM_OPENING_STOCK_BATCH_REQUIRED,
        msg: `Opening stock line ${index + 1} needs a batch because the item is batch tracked`,
      }
    }
    if (!input.isBatchTracked && line.batch) {
      return {
        error: Err.ITEM_OPENING_STOCK_BATCH_NOT_TRACKED,
        msg: `Opening stock line ${index + 1} has a batch but the item is not batch tracked`,
      }
    }
  }
  return null
}
