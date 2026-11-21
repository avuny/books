/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here,
 * so if a hook name or response shape differs, this is the one place to fix.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import {
  hasPermission,
  type PermissionSnapshot,
  type PermissionStatement,
} from "@avuny/contracts"

import {
  createBatch,
  getItem,
  getListItemOptionsQueryKey,
  getUnitCollection,
  listBatches,
  listItemOptions,
  getGetInventoryAdjustmentQueryKey,
  getListInventoryAdjustmentsQueryKey,
  useCancelInventoryAdjustment,
  useConfirmInventoryAdjustment,
  useCreateInventoryAdjustment,
  useDeleteInventoryAdjustment,
  useGetInventoryAdjustment,
  useGetInventoryAdjustmentSnapshot,
  useGetMyPermissions,
  useListWarehouseLocationOptions,
  useListWarehouseOptions,
  useListInventoryAdjustmentReasons,
  useListInventoryAdjustments,
  useUpdateInventoryAdjustment,
} from "@/api"
import { useCursorOptions } from "../lib/options/use-cursor-options"

import type {
  InventoryAdjustmentDto,
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentReasonDto,
  InventoryAdjustmentScope,
  StockSnapshotDto,
  StockSnapshotQuery,
} from "./types"

const NO_ADJUSTMENTS: InventoryAdjustmentListItemDto[] = []
const NO_REASONS: InventoryAdjustmentReasonDto[] = []

export function normalizeStatement(s: {
  effect?: "allow" | "deny" | string
  resource: string
  action: string
  resourceId?: string
}): PermissionStatement {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: s.resource as PermissionStatement["resource"],
    action: s.action as PermissionStatement["action"],
    resourceId: s.resourceId ?? "*",
  }
}

export function normalizeInventoryAdjustment(data: any): InventoryAdjustmentDto {
  return {
    id: data.id,
    number: data.number,
    referenceNumber: data.referenceNumber ?? null,
    date: data.date,
    warehouseId: data.warehouseId,
    reasonId: data.reasonId,
    description: data.description ?? null,
    status: data.status,
    createdBy: data.createdBy ?? null,
    confirmedBy: data.confirmedBy ?? null,
    confirmedAt: data.confirmedAt ?? null,
    stockMovementId: data.stockMovementId ?? null,
    journalEntryId: data.journalEntryId ?? null,
    lines: (data.lines ?? []).map((l: any, idx: number) => ({
      id: l.id,
      adjustmentId: l.adjustmentId ?? data.id,
      lineNo: l.lineNo ?? idx + 1,
      itemId: l.itemId,
      locationId: l.locationId,
      unitId: l.unitId,
      batchId: l.batchId ?? null,
      countedQuantity: l.countedQuantity,
      baseUnitId: l.baseUnitId,
      systemQuantityBase: l.systemQuantityBase,
      countedQuantityBase: l.countedQuantityBase,
      quantityDeltaBase: l.quantityDeltaBase,
      snapshotToken: l.snapshotToken ?? null,
      notes: l.notes ?? null,
      createdAt: l.createdAt ?? data.createdAt,
      updatedAt: l.updatedAt ?? data.updatedAt,
    })),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/* --------------------------------- queries -------------------------------- */

export type InventoryAdjustmentListParams = {
  page: number
  pageSize: number
  scope: InventoryAdjustmentScope
  search: string
}

export function useInventoryAdjustmentList(
  orgId: string,
  { page, pageSize, scope, search }: InventoryAdjustmentListParams
) {
  const query = useListInventoryAdjustments(
    orgId,
    {
      page,
      pageSize,
      status: scope === "all" ? undefined : scope,
      search: search || undefined,
    },
    {
      query: {
        placeholderData: keepPreviousData,
      },
    }
  )

  const items = useMemo(() => {
    return (query.data?.data?.items ?? NO_ADJUSTMENTS) as InventoryAdjustmentListItemDto[]
  }, [query.data])

  return {
    adjustments: items,
    total: query.data?.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useInventoryAdjustment(orgId: string, id: string) {
  const query = useGetInventoryAdjustment(orgId, id)
  const data = query.data?.data

  const adjustment = useMemo<InventoryAdjustmentDto | null>(
    () => (data ? normalizeInventoryAdjustment(data) : null),
    [data]
  )

  return {
    adjustment,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useInventoryAdjustmentReasons(orgId: string) {
  const query = useListInventoryAdjustmentReasons(orgId)
  const reasons = useMemo(() => {
    return (query.data?.data?.items ?? NO_REASONS) as InventoryAdjustmentReasonDto[]
  }, [query.data])

  return {
    reasons,
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function useStockSnapshot(orgId: string, queryParams: StockSnapshotQuery, enabled: boolean = true) {
  const query = useGetInventoryAdjustmentSnapshot(orgId, queryParams, {
    query: {
      enabled: enabled && Boolean(queryParams.warehouseId && queryParams.locationId && queryParams.itemId && queryParams.unitId),
    },
  })

  const snapshot = useMemo<StockSnapshotDto | null>(
    () => (query.data?.data ? (query.data.data as StockSnapshotDto) : null),
    [query.data]
  )

  return {
    snapshot,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useWarehouseOptions(orgId: string) {
  const query = useListWarehouseOptions(orgId, { limit: 50 })
  const options = useMemo(() => {
    return (query.data?.data?.items ?? []).map((w: any) => ({
      value: w.id as string,
      label: w.name as string,
    }))
  }, [query.data])

  return { options, isLoading: query.isLoading }
}

export function useWarehouseLocationOptions(orgId: string, warehouseId?: string) {
  const query = useListWarehouseLocationOptions(
    orgId,
    {
      warehouseId: warehouseId || undefined,
      stockableOnly: "true" as any,
      limit: 50,
    },
    {
      query: {
        enabled: Boolean(warehouseId),
      },
    }
  )

  const options = useMemo(() => {
    return (query.data?.data?.items ?? []).map((l: any) => ({
      value: l.id as string,
      label: (l.name ?? l.code) as string,
    }))
  }, [query.data])

  return { options, isLoading: query.isLoading }
}

export function useItemOptions(orgId: string) {
  return useCursorOptions({
    queryKey: getListItemOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listItemOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}

export async function fetchItemDetails(
  orgId: string,
  itemId: string
): Promise<{
  baseUnitId: string
  units: { value: string; label: string }[]
  isBatchTracked: boolean
}> {
  try {
    const itemRes = await getItem(orgId, itemId)
    const item = itemRes.data
    const isBatchTracked = Boolean(item.isBatchTracked)
    const baseUnitOption = {
      value: item.baseUnit.id,
      label: `${item.baseUnit.name} (${item.baseUnit.symbol})`,
    }

    if (!item.unitCollectionId) {
      return { baseUnitId: item.baseUnit.id, units: [baseUnitOption], isBatchTracked }
    }

    const collectionRes = await getUnitCollection(orgId, item.unitCollectionId)
    const collectionUnits = (collectionRes.data.units ?? []).map((u: any) => ({
      value: u.id as string,
      label: `${u.name} (${u.symbol})`,
    }))

    const exists = collectionUnits.some((u: any) => u.value === item.baseUnit.id)
    const allUnits = exists ? collectionUnits : [baseUnitOption, ...collectionUnits]

    return { baseUnitId: item.baseUnit.id, units: allUnits, isBatchTracked }
  } catch {
    return { baseUnitId: "", units: [], isBatchTracked: false }
  }
}

export const fetchItemUnits = fetchItemDetails

export async function fetchItemBatches(
  orgId: string,
  itemId: string
): Promise<{ value: string; label: string }[]> {
  try {
    const res = await listBatches(orgId, { itemId, pageSize: 50 })
    const items = res.data.items ?? []
    return items.map((b) => ({
      value: b.id,
      label: `${b.batchNumber}${b.expiresOn ? ` (Exp: ${b.expiresOn})` : ""}`,
    }))
  } catch {
    return []
  }
}

export async function createItemBatch(
  orgId: string,
  itemId: string,
  batchNumber: string
): Promise<{ value: string; label: string } | null> {
  try {
    const res = await createBatch(orgId, { itemId, number: batchNumber.trim() })
    const b = res.data
    return {
      value: b.id,
      label: `${b.batchNumber}${b.expiresOn ? ` (Exp: ${b.expiresOn})` : ""}`,
    }
  } catch {
    return null
  }
}

export function useInventoryAdjustmentAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data

  return useMemo(() => {
    if (!snapshot) {
      return {
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
        canConfirm: false,
        canCancel: false,
      }
    }

    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: (snapshot.statements ?? []).map(normalizeStatement),
    }

    return {
      canCreate: hasPermission(s, "create:inventory-adjustment"),
      canRead: hasPermission(s, "read:inventory-adjustment"),
      canUpdate: hasPermission(s, "update:inventory-adjustment"),
      canDelete: hasPermission(s, "delete:inventory-adjustment"),
      canConfirm: hasPermission(s, "confirm:inventory-adjustment"),
      canCancel: hasPermission(s, "cancel:inventory-adjustment"),
    }
  }, [snapshot])
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateInventoryAdjustments(orgId: string) {
  const queryClient = useQueryClient()

  return (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListInventoryAdjustmentsQueryKey(orgId),
      }),
      id
        ? queryClient.invalidateQueries({
            queryKey: getGetInventoryAdjustmentQueryKey(orgId, id),
          })
        : Promise.resolve(),
    ])
}

export function useCreateInventoryAdjustmentMutation(orgId: string) {
  const invalidate = useInvalidateInventoryAdjustments(orgId)
  return useCreateInventoryAdjustment({
    mutation: {
      onSuccess: () => invalidate(),
    },
  })
}

export function useUpdateInventoryAdjustmentMutation(orgId: string) {
  const invalidate = useInvalidateInventoryAdjustments(orgId)
  return useUpdateInventoryAdjustment({
    mutation: {
      onSuccess: (_res, vars) => invalidate(vars.id),
    },
  })
}

export function useDeleteInventoryAdjustmentMutation(orgId: string) {
  const invalidate = useInvalidateInventoryAdjustments(orgId)
  return useDeleteInventoryAdjustment({
    mutation: {
      onSuccess: () => invalidate(),
    },
  })
}

export function useConfirmInventoryAdjustmentMutation(orgId: string) {
  const invalidate = useInvalidateInventoryAdjustments(orgId)
  return useConfirmInventoryAdjustment({
    mutation: {
      onSuccess: (_res, vars) => invalidate(vars.id),
    },
  })
}

export function useCancelInventoryAdjustmentMutation(orgId: string) {
  const invalidate = useInvalidateInventoryAdjustments(orgId)
  return useCancelInventoryAdjustment({
    mutation: {
      onSuccess: (_res, vars) => invalidate(vars.id),
    },
  })
}
