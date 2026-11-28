import { computeLineValueMinor, type CreateItemInput } from "@avuny/contracts"
import { ItemErrorCode as Err } from "./item.errors.js"
import { toBaseQuantity, toBaseUnitPrice } from "./item-unit.rules.js"

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

type OpeningStock = NonNullable<CreateItemInput["openingStock"]>

/** One opening stock line in the item's BASE unit, ready to post. */
export type NormalizedOpeningLine = Omit<OpeningStock["lines"][number], "unitId" | "postedAt"> & {
  /** ISO datetime this line is posted at. */
  postedAt: string
  /** Line value in minor units, computed from the ENTERED quantity and cost (no base-unit rounding). */
  valueMinor: bigint
}

/** Conversion context of the item's unit collection: unit id -> factor to the base unit (base = "1"). */
export type OpeningStockUnits = { baseUnitId: string; factors: ReadonlyMap<string, string> }

/**
 * Converts opening stock lines entered in any unit of the item's collection to the base unit
 * (quantity = entered * factor, cost = entered cost / factor) and resolves each line's posting
 * date: the line's own, else the opening stock default, else `nowIso`.
 */
export function normalizeOpeningStock(
  opening: OpeningStock,
  units: OpeningStockUnits,
  nowIso: string
): { ok: true; lines: NormalizedOpeningLine[] } | { ok: false; violation: OpeningStockViolation } {
  const lines: NormalizedOpeningLine[] = []
  for (const [index, line] of opening.lines.entries()) {
    const { unitId, postedAt, ...rest } = line
    let quantity = line.quantity
    let cost = line.cost ?? null
    if (unitId && unitId !== units.baseUnitId) {
      const factor = units.factors.get(unitId)
      if (!factor) {
        return {
          ok: false,
          violation: {
            error: Err.ITEM_OPENING_STOCK_UNIT_INVALID,
            msg: `Opening stock line ${index + 1} uses a unit that is not in the item's unit collection`,
          },
        }
      }
      quantity = toBaseQuantity(line.quantity, factor)
      cost = cost === null ? null : toBaseUnitPrice(cost, factor)
    }
    lines.push({
      ...rest,
      quantity,
      cost,
      postedAt: postedAt ?? opening.postedAt ?? nowIso,
      valueMinor: computeLineValueMinor(line.quantity, line.cost ?? "0", 0) ?? 0n,
    })
  }
  return { ok: true, lines }
}
