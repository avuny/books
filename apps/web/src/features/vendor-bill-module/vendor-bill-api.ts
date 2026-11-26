/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  hasPermission,
  type PermissionSnapshot,
  type PermissionStatement,
} from "@avuny/contracts"

import {
  getGetVendorBillQueryKey,
  getListVendorBillsQueryKey,
  getListVendorPaymentsQueryKey,
  getListPurchaseReceiptsQueryKey,
  useCreateVendorBillFromReceipt,
  useCreateVendorPayment,
  useDeleteVendorBill,
  useDeleteVendorPayment,
  useGetMyPermissions,
  useGetVendorBill,
  useListVendorBills,
  useListVendorPayments,
  usePostVendorBill,
  usePostVendorPayment,
  useReverseVendorBill,
  useReverseVendorPayment,
} from "@/api"

import type { VendorBillDto, VendorPaymentDto } from "./types"

const NO_BILLS: VendorBillDto[] = []
const NO_PAYMENTS: VendorPaymentDto[] = []

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

export function useVendorBills(orgId: string) {
  const query = useListVendorBills(orgId)
  const bills = useMemo(
    () => (query.data?.data?.items ?? NO_BILLS) as VendorBillDto[],
    [query.data]
  )
  return { bills, isLoading: query.isLoading, error: query.error }
}

export function useVendorBill(orgId: string, id: string) {
  const query = useGetVendorBill(orgId, id)
  const bill = useMemo<VendorBillDto | null>(
    () => (query.data?.data ? (query.data.data as VendorBillDto) : null),
    [query.data]
  )
  return { bill, isLoading: query.isLoading, error: query.error }
}

export function useVendorPayments(orgId: string) {
  const query = useListVendorPayments(orgId)
  const payments = useMemo(
    () => (query.data?.data?.items ?? NO_PAYMENTS) as VendorPaymentDto[],
    [query.data]
  )
  return { payments, isLoading: query.isLoading, error: query.error }
}

export function useVendorBillAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) {
      return {
        canCreateBill: false,
        canPostBill: false,
        canReverseBill: false,
        canDeleteBill: false,
        canCreatePayment: false,
        canPostPayment: false,
        canReversePayment: false,
        canDeletePayment: false,
      }
    }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: (snapshot.statements ?? []).map(normalizeStatement),
    }
    return {
      canCreateBill: hasPermission(s, "create:vendor-bill"),
      canPostBill: hasPermission(s, "post:vendor-bill"),
      canReverseBill: hasPermission(s, "reverse:vendor-bill"),
      canDeleteBill: hasPermission(s, "delete:vendor-bill"),
      canCreatePayment: hasPermission(s, "create:vendor-payment"),
      canPostPayment: hasPermission(s, "post:vendor-payment"),
      canReversePayment: hasPermission(s, "reverse:vendor-payment"),
      canDeletePayment: hasPermission(s, "delete:vendor-payment"),
    }
  }, [snapshot])
}

function useInvalidate(orgId: string) {
  const qc = useQueryClient()
  return async (billId?: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListVendorBillsQueryKey(orgId) }),
      qc.invalidateQueries({ queryKey: getListVendorPaymentsQueryKey(orgId) }),
      qc.invalidateQueries({ queryKey: getListPurchaseReceiptsQueryKey(orgId) }),
      billId
        ? qc.invalidateQueries({ queryKey: getGetVendorBillQueryKey(orgId, billId) })
        : Promise.resolve(),
    ])
  }
}

export function useCreateBillFromReceiptMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCreateVendorBillFromReceipt({ mutation: { onSuccess: () => invalidate() } })
}
export function usePostBillMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return usePostVendorBill({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useReverseBillMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseVendorBill({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useDeleteBillMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDeleteVendorBill({ mutation: { onSuccess: () => invalidate() } })
}
export function useCreatePaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCreateVendorPayment({ mutation: { onSuccess: () => invalidate() } })
}
export function usePostPaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return usePostVendorPayment({ mutation: { onSuccess: () => invalidate() } })
}
export function useReversePaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseVendorPayment({ mutation: { onSuccess: () => invalidate() } })
}
export function useDeletePaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDeleteVendorPayment({ mutation: { onSuccess: () => invalidate() } })
}
