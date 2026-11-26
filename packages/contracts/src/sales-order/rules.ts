import { cmpQty, isPositiveQty, subQty } from "../purchase-order/rules.js"

/**
 * Pure sales order rules shared by the API and the web app. Decimal-string math and line money
 * math (computeLineAmounts, sumLineAmounts) are reused from the purchase order rules so that
 * both modules round identically. Quantities are decimal strings in the item's base unit.
 */

/* ---------- line quantity derivations (SPEC 3.3) ---------- */

export interface SalesOrderLineCounters {
  orderedBaseQty: string
  cancelledBaseQty: string
  reservedBaseQty: string
  deliveredBaseQty: string
}

export const openToDeliverBaseQty = (l: SalesOrderLineCounters) =>
  subQty(subQty(l.orderedBaseQty, l.cancelledBaseQty), l.deliveredBaseQty)

export const unreservedOpenBaseQty = (l: SalesOrderLineCounters) => {
  const gap = subQty(openToDeliverBaseQty(l), l.reservedBaseQty)
  return cmpQty(gap, "0") === 1 ? gap : "0"
}

export type FulfillmentSummary = "NOT_DELIVERED" | "PARTIALLY_DELIVERED" | "DELIVERED"

/** Display-only fulfillment summary for a confirmed order (SPEC 3.3). */
export function deriveFulfillmentSummary(lines: readonly SalesOrderLineCounters[]): FulfillmentSummary {
  const active = lines.filter((l) => isPositiveQty(subQty(l.orderedBaseQty, l.cancelledBaseQty)))
  if (active.length === 0) return "NOT_DELIVERED"
  if (active.every((l) => cmpQty(openToDeliverBaseQty(l), "0") <= 0)) return "DELIVERED"
  return active.some((l) => isPositiveQty(l.deliveredBaseQty)) ? "PARTIALLY_DELIVERED" : "NOT_DELIVERED"
}

export interface ReservationNeed {
  /** Quantity the line still needs reserved, in base units. */
  needBaseQty: string
  /** Live available stock (onHand - reserved) for the line's location, in base units. */
  availableBaseQty: string
}

/** How much to reserve for a line: the smaller of need and available (never negative). */
export function reservableBaseQty(n: ReservationNeed): string {
  const avail = cmpQty(n.availableBaseQty, "0") === 1 ? n.availableBaseQty : "0"
  return cmpQty(n.needBaseQty, avail) <= 0 ? n.needBaseQty : avail
}
