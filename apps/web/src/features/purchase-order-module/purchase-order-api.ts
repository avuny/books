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
