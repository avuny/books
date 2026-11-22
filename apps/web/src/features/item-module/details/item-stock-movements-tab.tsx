"use client"

import { StockMovementList } from "../../stock-movement-module"

export interface ItemStockMovementsTabProps {
  orgId: string
  itemId: string
  baseUnitSymbol?: string
}

export function ItemStockMovementsTab({
  orgId,
  itemId,
  baseUnitSymbol,
}: ItemStockMovementsTabProps) {
  return (
    <StockMovementList
      orgId={orgId}
      fixedItemId={itemId}
      fixedItemBaseUnitSymbol={baseUnitSymbol}
    />
  )
}
