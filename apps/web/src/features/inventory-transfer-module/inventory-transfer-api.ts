/**
 * The only file in this module that knows the shape of the generated API client (@/api).
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot } from "@avuny/contracts"
import type { InventoryTransferDto, InventoryTransferListItemDto } from "@avuny/contracts/inventory-transfer"

import {
  getGetInventoryTransferQueryKey,
  getItem,
  getListInventoryTransfersQueryKey,
  getUnitCollection,
  listItemOptions,
  useCancelInventoryTransfer,
  useCloseShortInventoryTransfer,
  useCreateInventoryTransfer,
  useDeleteInventoryTransfer,
  useDispatchInventoryTransfer,
  useGetInventoryTransfer,
  useGetMyPermissions,
  useListInventoryTransfers,
  useListWarehouseLocationOptions,
  useListWarehouseOptions,
  useReceiveInventoryTransfer,
  useReturnInventoryTransfer,
  useReverseInventoryTransfer,
  useReverseInventoryTransferReceipt,
} from "@/api"

export type { InventoryTransferDto, InventoryTransferListItemDto }

export type TransferStatus = "DRAFT" | "IN_TRANSIT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"
export type Option = { value: string; label: string }

const NO_ROWS: InventoryTransferListItemDto[] = []

export function useTransferList(
  orgId: string,
  p: { page: number; pageSize: number; status: TransferStatus | "all"; search: string }
) {
  const q = useListInventoryTransfers(
    orgId,
    {
      page: p.page,
      pageSize: p.pageSize,
      status: p.status === "all" ? undefined : p.status,
      search: p.search || undefined,
    } as any,
    { query: { placeholderData: keepPreviousData } }
  )
  const data = q.data?.data as any
  return {
    rows: (data?.items ?? NO_ROWS) as InventoryTransferListItemDto[],
    total: (data?.total ?? 0) as number,
    isLoading: q.isLoading,
  }
}

export function useTransfer(orgId: string, id: string) {
  const q = useGetInventoryTransfer(orgId, id)
  const transfer = useMemo(() => (q.data?.data ?? null) as InventoryTransferDto | null, [q.data])
  return { transfer, isLoading: q.isLoading, error: q.error }
}

export function useTransferAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    const none = {
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canDispatch: false,
      canReceive: false,
      canReturn: false,
      canCloseShort: false,
      canCancel: false,
      canReverse: false,
    }
    if (!snapshot) return none
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: (snapshot.statements ?? []).map((x: any) => ({
        effect: x.effect === "deny" ? "deny" : "allow",
        resource: x.resource,
        action: x.action,
        resourceId: x.resourceId ?? "*",
      })),
    }
    const can = (k: string) => hasPermission(s, k as any)
    return {
      canCreate: can("create:inventory-transfer"),
      canUpdate: can("update:inventory-transfer"),
      canDelete: can("delete:inventory-transfer"),
      canDispatch: can("dispatch:inventory-transfer"),
      canReceive: can("receive:inventory-transfer"),
      canReturn: can("return:inventory-transfer"),
      canCloseShort: can("close_short:inventory-transfer"),
      canCancel: can("cancel:inventory-transfer"),
      canReverse: can("reverse:inventory-transfer"),
    }
  }, [snapshot])
}

export function useWarehouseOptions(orgId: string) {
  const q = useListWarehouseOptions(orgId, { limit: 50 } as any)
  const options = useMemo<Option[]>(
    () => ((q.data?.data?.items ?? []) as any[]).map((w) => ({ value: w.id, label: w.name })),
    [q.data]
  )
  return { options, isLoading: q.isLoading }
}

export function useLocationOptions(orgId: string, warehouseId?: string) {
  const q = useListWarehouseLocationOptions(
    orgId,
    { warehouseId: warehouseId || undefined, stockableOnly: "true" as any, limit: 50 } as any,
    { query: { enabled: Boolean(warehouseId) } as any }
  )
  const options = useMemo<Option[]>(
    () => ((q.data?.data?.items ?? []) as any[]).map((l) => ({ value: l.id, label: l.name ?? l.code })),
    [q.data]
  )
  return { options, isLoading: q.isLoading }
}

export async function fetchItemOptions(orgId: string, search: string): Promise<Option[]> {
  try {
    const res = await listItemOptions(orgId, { search: search || undefined, limit: 50 } as any)
    return ((res.data as any).items ?? []).map((i: any) => ({ value: i.id, label: i.name }))
  } catch {
    return []
  }
}

/** Units the item can be transferred in: its base unit plus its unit collection. */
export async function fetchItemUnits(orgId: string, itemId: string): Promise<Option[]> {
  try {
    const item = (await getItem(orgId, itemId)).data as any
    const base = { value: item.baseUnit.id as string, label: `${item.baseUnit.name} (${item.baseUnit.symbol})` }
    if (!item.unitCollectionId) return [base]
    const coll = (await getUnitCollection(orgId, item.unitCollectionId)).data as any
    const units: Option[] = (coll.units ?? []).map((u: any) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))
    return units.some((u) => u.value === base.value) ? units : [base, ...units]
  } catch {
    return []
  }
}

/* ------------------------------- mutations ------------------------------- */

function useInvalidate(orgId: string) {
  const qc = useQueryClient()
  return (id?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: getListInventoryTransfersQueryKey(orgId) }),
      id ? qc.invalidateQueries({ queryKey: getGetInventoryTransferQueryKey(orgId, id) }) : Promise.resolve(),
    ])
}

export function useCreateTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCreateInventoryTransfer({ mutation: { onSuccess: () => invalidate() } })
}
export function useDeleteTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDeleteInventoryTransfer({ mutation: { onSuccess: () => invalidate() } })
}
export function useCancelTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCancelInventoryTransfer({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useDispatchTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDispatchInventoryTransfer({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useReceiveTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReceiveInventoryTransfer({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useReturnTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReturnInventoryTransfer({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useCloseShortTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCloseShortInventoryTransfer({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useReverseTransferMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseInventoryTransfer({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useReverseReceiptMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseInventoryTransferReceipt({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
