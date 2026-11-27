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
  getGetSalesOrderQueryKey,
  getListSalesOrdersQueryKey,
  useCancelSalesOrder,
  useCloseSalesOrder,
  useConfirmSalesOrder,
  useDeleteSalesOrder,
  useGetMyPermissions,
  useGetSalesOrder,
  useListSalesOrders,
} from "@/api"

import type {
  SalesOrderDto,
  SalesOrderListItemDto,
  SalesOrderScope,
} from "./types"

const NO_ORDERS: SalesOrderListItemDto[] = []

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

export type SalesOrderListParams = {
  page: number
  pageSize: number
  scope: SalesOrderScope
  search: string
}

export function useSalesOrderList(
  orgId: string,
  { page, pageSize, scope, search }: SalesOrderListParams
) {
  const query = useListSalesOrders(
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
    () => (query.data?.data?.items ?? NO_ORDERS) as SalesOrderListItemDto[],
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

export function useSalesOrder(orgId: string, id: string) {
  const query = useGetSalesOrder(orgId, id)
  const order = useMemo<SalesOrderDto | null>(
    () => (query.data?.data ? (query.data.data as SalesOrderDto) : null),
    [query.data]
  )
  return { order, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useSalesOrderAbilities(orgId: string) {
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
        canManagePaymentTerms: false,
      }
    }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: (snapshot.statements ?? []).map(normalizeStatement),
    }
    return {
      canCreate: hasPermission(s, "create:sales-order"),
      canRead: hasPermission(s, "read:sales-order"),
      canUpdate: hasPermission(s, "update:sales-order"),
      canDelete: hasPermission(s, "delete:sales-order"),
      canConfirm: hasPermission(s, "confirm:sales-order"),
      canClose: hasPermission(s, "close:sales-order"),
      canCancel: hasPermission(s, "cancel:sales-order"),
      canManagePaymentTerms:
        hasPermission(s, "create:payment-term") && hasPermission(s, "update:payment-term"),
    }
  }, [snapshot])
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateSalesOrders(orgId: string) {
  const queryClient = useQueryClient()
  return (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListSalesOrdersQueryKey(orgId) }),
      id
        ? queryClient.invalidateQueries({ queryKey: getGetSalesOrderQueryKey(orgId, id) })
        : Promise.resolve(),
    ])
}

export function useDeleteSalesOrderMutation(orgId: string) {
  const invalidate = useInvalidateSalesOrders(orgId)
  return useDeleteSalesOrder({ mutation: { onSuccess: () => invalidate() } })
}

export function useConfirmSalesOrderMutation(orgId: string) {
  const invalidate = useInvalidateSalesOrders(orgId)
  return useConfirmSalesOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}

export function useCloseSalesOrderMutation(orgId: string) {
  const invalidate = useInvalidateSalesOrders(orgId)
  return useCloseSalesOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}

export function useCancelSalesOrderMutation(orgId: string) {
  const invalidate = useInvalidateSalesOrders(orgId)
  return useCancelSalesOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}

/* ------------------------------ form helpers ------------------------------ */

import {
  getItem,
  getListItemOptionsQueryKey,
  getUnitCollection,
  listItemOptions,
  useCreateSalesOrder,
  useListPaymentTerms,
  useUpdateSalesOrder,
  useListWarehouseLocationOptions,
  listWarehouseLocationOptions,
  getListWarehouseLocationOptionsQueryKey,
  useListWarehouseOptions,
  usePreviewSalesOrderNumber,
} from "@/api"
import { useCursorOptions } from "../lib/options/use-cursor-options"

export function useCreateSalesOrderMutation(orgId: string) {
  const invalidate = useInvalidateSalesOrders(orgId)
  return useCreateSalesOrder({ mutation: { onSuccess: () => invalidate() } })
}

export function useSalesOrderDefaults(orgId: string) {
  const query = usePreviewSalesOrderNumber(orgId)
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

/** Async picker source for stockable locations of one warehouse (search and paging like the item picker). */
export function useLocationSource(orgId: string, warehouseId?: string) {
  return useCursorOptions({
    queryKey: getListWarehouseLocationOptionsQueryKey(orgId, { warehouseId: warehouseId || undefined }),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (
        await listWarehouseLocationOptions(
          orgId,
          { warehouseId: warehouseId || undefined, stockableOnly: "true" as never, cursor, search, limit },
          { signal }
        )
      ).data,
    enabled: Boolean(orgId && warehouseId),
  })
}

export function useItemSource(orgId: string) {
  return useCursorOptions({
    queryKey: getListItemOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listItemOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}

/** "12.500000" -> "12.5", "12.000000" -> "12". */
function trimDecimal(v: string): string {
  return v.includes(".") ? v.replace(/0+$/, "").replace(/\.$/, "") : v
}

/** Units an item can be ordered in: its unit collection, plus the base unit. */
export async function fetchItemUnits(
  orgId: string,
  itemId: string
): Promise<{ baseUnitId: string; units: { value: string; label: string }[]; costPrice: string | null }> {
  try {
    const item = (await getItem(orgId, itemId)).data
    const base = {
      value: item.baseUnit.id,
      label: `${item.baseUnit.name} (${item.baseUnit.symbol})`,
    }
    const costPrice = item.costPrice ? trimDecimal(item.costPrice) : null
    if (!item.unitCollectionId) return { baseUnitId: item.baseUnit.id, units: [base], costPrice }
    const collection = (await getUnitCollection(orgId, item.unitCollectionId)).data
    const units = (collection.units ?? []).map((u: { id: string; name: string; symbol: string }) => ({
      value: u.id,
      label: `${u.name} (${u.symbol})`,
    }))
    return {
      baseUnitId: item.baseUnit.id,
      costPrice,
      units: units.some((u: { value: string }) => u.value === item.baseUnit.id) ? units : [base, ...units],
    }
  } catch {
    return { baseUnitId: "", units: [], costPrice: null }
  }
}

export function useUpdateSalesOrderMutation(orgId: string) {
  const invalidate = useInvalidateSalesOrders(orgId)
  return useUpdateSalesOrder({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
