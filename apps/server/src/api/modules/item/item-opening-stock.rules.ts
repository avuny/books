import type { CreateItemInput } from "@avuny/contracts"
import { ItemErrorCode as Err } from "./item.errors.js"

export type OpeningStockViolation = { error: Err; msg: string }

/**
 * Pure checks of the opening stock on a new item, run before anything is written.
 * - opening stock needs an inventory-tracked item;
 * - expiry-tracked items need a manufacture date on every opening stock line (batch & expiry date are auto-generated).
 * Quantities, locations and batch dates are checked by the stock and batch modules when posting.
 */
export function checkOpeningStock(
  input: Pick<CreateItemInput, "isInventoryTracked" | "isBatchTracked" | "isExpiryTracked" | "openingStock">
): OpeningStockViolation | null {
  if (!input.openingStock) return null
  if (!input.isInventoryTracked) {
    return { error: Err.ITEM_OPENING_STOCK_NOT_TRACKED, msg: "Opening stock needs an inventory-tracked item" }
  }
  if (input.isExpiryTracked) {
    for (const [index, line] of input.openingStock.lines.entries()) {
      const manufacturedOn = line.manufacturedOn ?? line.batch?.manufacturedOn
      if (!manufacturedOn) {
        return {
          error: Err.ITEM_EXPIRY_DATE_REQUIRED,
          msg: `Opening stock line ${index + 1} needs a manufacture date because the item is expiry tracked`,
        }
      }
    }
  }
  return null
}
