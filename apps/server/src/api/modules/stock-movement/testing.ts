import type { StockItemPolicy, StockItemsPort } from "./stock-movement.types.js"

/**
 * Test double and placeholder: every item exists, is active and tracks stock, is not batch tracked,
 * and none may go negative (the strict choice). Production wiring uses the item module (see deps.ts).
 */
export class DummyStockItems implements StockItemsPort {
  async findPolicies(_orgId: string, itemIds: readonly string[]): Promise<Map<string, StockItemPolicy>> {
    return new Map(
      itemIds.map((id) => [
        id,
        {
          isActive: true,
          tracksStock: true,
          isBatchTracked: false,
          isExpiryTracked: false,
          allowNegativeStock: false,
        },
      ])
    )
  }
}
