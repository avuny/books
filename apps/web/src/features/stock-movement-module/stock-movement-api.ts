import { useQuery } from "@tanstack/react-query"
import {
  getItem,
  getUnitCollection,
  useListStockMovements,
} from "@/api"
import type { ListStockMovementsParams } from "@/api/model"
import type { DisplayUnitOption, StockMovementLineHistoryItem } from "./types"

export function normalizeStockMovement(
  raw: any
): StockMovementLineHistoryItem {
  return {
    lineId: raw.lineId,
    movementId: raw.movementId,
    lineNo: raw.lineNo,
    type: raw.type,
    postedAt: raw.postedAt,
    sourceType: raw.sourceType ?? null,
    sourceId: raw.sourceId ?? null,
    sourceRef: raw.sourceRef ?? null,
    isReversal: Boolean(raw.isReversal),
    itemId: raw.itemId,
    itemName: raw.itemName ?? null,
    baseUnitSymbol: raw.baseUnitSymbol ?? null,
    batchId: raw.batchId ?? null,
    fromLocationId: raw.fromLocationId,
    fromLocationCode: raw.fromLocationCode ?? null,
    fromLocationName: raw.fromLocationName ?? null,
    fromWarehouseId: raw.fromWarehouseId ?? null,
    fromWarehouseName: raw.fromWarehouseName ?? null,
    fromWarehouseType: raw.fromWarehouseType ?? null,
    toLocationId: raw.toLocationId,
    toLocationCode: raw.toLocationCode ?? null,
    toLocationName: raw.toLocationName ?? null,
    toWarehouseId: raw.toWarehouseId ?? null,
    toWarehouseName: raw.toWarehouseName ?? null,
    toWarehouseType: raw.toWarehouseType ?? null,
    physicalWarehouseId: raw.physicalWarehouseId ?? null,
    physicalWarehouseName: raw.physicalWarehouseName ?? null,
    physicalLocationId: raw.physicalLocationId ?? null,
    physicalLocationCode: raw.physicalLocationCode ?? null,
    physicalLocationName: raw.physicalLocationName ?? null,
    direction: raw.direction ?? (raw.toWarehouseType === "physical" ? "IN" : "OUT"),
    quantity: raw.quantity,
    runningBalance: raw.runningBalance,
  }
}

export function useStockMovements(
  orgId: string,
  params?: ListStockMovementsParams,
  options?: { enabled?: boolean }
) {
  const query = useListStockMovements(orgId, params, {
    query: {
      enabled: options?.enabled ?? Boolean(orgId),
    },
  })

  const rawData = query.data?.data
  const items: StockMovementLineHistoryItem[] = (rawData?.items ?? []).map(
    normalizeStockMovement
  )

  return {
    ...query,
    items,
    total: rawData?.total ?? 0,
    page: rawData?.page ?? 1,
    pageSize: rawData?.pageSize ?? (params?.pageSize ? Number(params.pageSize) : 20),
  }
}

/**
 * Fetches the base unit and all alternate units for an item from its unit collection.
 */
export function useItemUnitOptions(orgId: string, itemId?: string) {
  return useQuery({
    queryKey: ["item-unit-options", orgId, itemId],
    queryFn: async (): Promise<DisplayUnitOption[]> => {
      if (!orgId || !itemId) return []
      try {
        const itemRes = await getItem(orgId, itemId)
        const item = itemRes.data
        if (!item) return []

        const baseUnit: DisplayUnitOption = {
          id: item.baseUnit.id,
          name: item.baseUnit.name,
          symbol: item.baseUnit.symbol,
          conversionFactor: "1",
          isBase: true,
        }

        if (!item.unitCollectionId) {
          return [baseUnit]
        }

        const collectionRes = await getUnitCollection(orgId, item.unitCollectionId)
        const collection = collectionRes.data
        if (!collection || !collection.units) {
          return [baseUnit]
        }

        const units: DisplayUnitOption[] = collection.units.map((u) => ({
          id: u.id,
          name: u.name,
          symbol: u.symbol,
          conversionFactor: u.conversionFactor || "1",
          isBase: Boolean(u.isBase),
        }))

        // Ensure base unit is included if not present
        if (!units.some((u) => u.id === baseUnit.id)) {
          units.unshift(baseUnit)
        }

        return units
      } catch {
        return []
      }
    },
    enabled: Boolean(orgId && itemId),
  })
}
