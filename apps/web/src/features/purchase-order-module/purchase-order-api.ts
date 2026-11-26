/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import {
  hasPermission,
  type PermissionSnapshot,
  type PermissionStatement,
} from "@avuny/contracts"

import {
  getGetPurchaseOrderQueryKey,
  getListPurchaseOrdersQueryKey,
  useCancelPurchaseOrder,
  useClosePurchaseOrder,
  useConfirmPurchaseOrder,
  useDeletePurchaseOrder,
  useGetMyPermissions,
  useGetPurchaseOrder,
  useListPurchaseOrders,
} from "@/api"

import type {
  PurchaseOrderDto,
  PurchaseOrderListItemDto,
  PurchaseOrderScope,
} from "./types"

const NO_ORDERS: PurchaseOrderListItemDto[] = []

function normalizeStatement(s: {
  effect?: string
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

export type PurchaseOrderListParams = {
  page: number
  pageSize: number
  scope: PurchaseOrderScope
  search: string
}

export function usePurchaseOrderList(
  orgId: string,
  { page, pageSize, scope, search }: PurchaseOrderListParams
) {
  const query = useListPurchaseOrders(
    orgId,
    {
      page,
      pageSize,
      status: scope === "all" ? undefined : scope,
      search: search || undefined,
    },
    { query: { placeholderData: keepPreviousData } }
  )

  const items = useMemo(
    () => (query.data?.data?.items ?? NO_ORDERS) as PurchaseOrderListItemDto[],
    [query.data]
  )

  return {
    orders: items,
    total: query.data?.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function usePurchaseOrder(orgId: string, id: string) {
  const query = useGetPurchaseOrder(orgId, id)
  const order = useMemo<PurchaseOrderDto | null>(
    () => (query.data?.data ? (query.data.data as PurchaseOrderDto) : null),
    [query.data]
  )
  return { order, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function usePurchaseOrderAbilities(orgId: string) {
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
        canClose: false,
        canCancel: false,
      }
    }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: (snapshot.statements ?? []).map(normalizeStatement),
    }
    return {
      canCreate: hasPermission(s, "create:purchase-order"),
      canRead: hasPermission(s, "read:purchase-order"),
      canUpdate: hasPermission(s, "update:purchase-order"),
      canDelete: hasPermission(s, "delete:purchase-order"),
      canConfirm: hasPermission(s, "confirm:purchase-order"),
      canClose: hasPermission(s, "close:purchase-order"),
      canCancel: hasPermission(s, "cancel:purchase-order"),
    }
  }, [snapshot])
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidatePurchaseOrders(orgId: string) {
  const queryClient = useQueryClient()
  return (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey(orgId) }),
      id
        ? queryClient.invalidateQueries({ queryKey: getGetPurchaseOrderQueryKey(orgId, id) })
        : Promise.resolve(),
    ])
}

export function useDeletePurchaseOrderMutation(orgId: string) {
  const invalidate = useInvalidatePurchaseOrders(orgId)
  return useDeletePurchaseOrder({ mutation: { onSuccess: () => invalidate() } })
}

export function useConfirmPurchaseOrderMutation(orgId: string) {
  const invalidate = useInvalidatePurchaseOrders(orgId)
  return useConfirmPurchaseOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}

export function useClosePurchaseOrderMutation(orgId: string) {
  const invalidate = useInvalidatePurchaseOrders(orgId)
  return useClosePurchaseOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}

export function useCancelPurchaseOrderMutation(orgId: string) {
  const invalidate = useInvalidatePurchaseOrders(orgId)
  return useCancelPurchaseOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}

/* ------------------------------ form helpers ------------------------------ */

import {
  getItem,
  getListItemOptionsQueryKey,
  getUnitCollection,
  listItemOptions,
  useCreatePurchaseOrder,
  useListPaymentTerms,
  useListWarehouseLocationOptions,
  useListWarehouseOptions,
  usePreviewPurchaseOrderNumber,
} from "@/api"
import { useCursorOptions } from "../lib/options/use-cursor-options"

export function useCreatePurchaseOrderMutation(orgId: string) {
  const invalidate = useInvalidatePurchaseOrders(orgId)
  return useCreatePurchaseOrder({ mutation: { onSuccess: () => invalidate() } })
}

export function usePurchaseOrderDefaults(orgId: string) {
  const query = usePreviewPurchaseOrderNumber(orgId)
  return { today: query.data?.data?.today, currency: query.data?.data?.currency, number: query.data?.data?.number }
}

export function usePaymentTermOptions(orgId: string) {
  const query = useListPaymentTerms(orgId)
  return useMemo(
    () =>
      ((query.data?.data as { items?: { id: string; name: string }[] } | undefined)?.items ?? []).map((p) => ({
        value: p.id,
        label: p.name,
      })),
    [query.data]
  )
}

export function useWarehouseOptions(orgId: string) {
  const query = useListWarehouseOptions(orgId, { limit: 50 })
  const options = useMemo(
    () =>
      (query.data?.data?.items ?? []).map((w: { id: string; name: string }) => ({
        value: w.id,
        label: w.name,
      })),
    [query.data]
  )
  return { options, isLoading: query.isLoading }
}

export function useStockLocationOptions(orgId: string, warehouseId?: string) {
  const query = useListWarehouseLocationOptions(
    orgId,
    { warehouseId: warehouseId || undefined, stockableOnly: "true" as never, limit: 50 },
    { query: { enabled: Boolean(warehouseId) } }
  )
  return useMemo(
    () =>
      (query.data?.data?.items ?? []).map((l: { id: string; name?: string; code?: string }) => ({
        value: l.id,
        label: (l.name ?? l.code ?? l.id) as string,
      })),
    [query.data]
  )
}

export function useItemSource(orgId: string) {
  return useCursorOptions({
    queryKey: getListItemOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listItemOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}

/** Units an item can be ordered in: its unit collection, plus the base unit. */
export async function fetchItemUnits(
  orgId: string,
  itemId: string
): Promise<{ baseUnitId: string; units: { value: string; label: string }[] }> {
  try {
    const item = (await getItem(orgId, itemId)).data
    const base = {
      value: item.baseUnit.id,
      label: `${item.baseUnit.name} (${item.baseUnit.symbol})`,
    }
    if (!item.unitCollectionId) return { baseUnitId: item.baseUnit.id, units: [base] }
    const collection = (await getUnitCollection(orgId, item.unitCollectionId)).data
    const units = (collection.units ?? []).map((u: { id: string; name: string; symbol: string }) => ({
      value: u.id,
      label: `${u.name} (${u.symbol})`,
    }))
    return {
      baseUnitId: item.baseUnit.id,
      units: units.some((u: { value: string }) => u.value === item.baseUnit.id) ? units : [base, ...units],
    }
  } catch {
    return { baseUnitId: "", units: [] }
  }
}
