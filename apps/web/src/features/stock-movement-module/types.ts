import type {
  StockMovementLineHistoryItem,
  StockMovementLineHistoryQuery,
  StockMovementType,
} from "@avuny/contracts"

export type { StockMovementLineHistoryItem, StockMovementLineHistoryQuery, StockMovementType }

export interface DisplayUnitOption {
  id: string
  name: string
  symbol: string
  conversionFactor: string
  isBase: boolean
}

export interface StockMovementFilterState {
  itemId?: string
  warehouseIds: string[]
  locationIds: string[]
  type?: StockMovementType
  from?: string
  to?: string
}

export interface StockMovementListProps {
  orgId: string
  /**
   * When provided, scopes the listing strictly to this item:
   * - Item column is hidden
   * - Item filter is hidden/disabled
   * - Display Unit selector is visible with that item's base and additional units
   */
  fixedItemId?: string
  /** Optional fallback base unit symbol if item details are not loaded yet */
  fixedItemBaseUnitSymbol?: string
  className?: string
}

export type StockMovementDirection = "IN" | "OUT"
