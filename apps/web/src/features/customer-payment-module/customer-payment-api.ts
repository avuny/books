/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot, type PermissionStatement } from "@avuny/contracts"

import {
  getGetSalesInvoiceQueryKey,
  getListCustomerPaymentsQueryKey,
  getListSalesInvoicesQueryKey,
  useCreateCustomerPayment,
  useDeleteCustomerPayment,
  useGetMyPermissions,
  useListCustomerPayments,
  usePostCustomerPayment,
  useReverseCustomerPayment,
} from "@/api"

import type { CustomerPaymentDto } from "./types"

const NO_PAYMENTS: CustomerPaymentDto[] = []

function normalizeStatement(s: { effect?: string; resource: string; action: string; resourceId?: string }): PermissionStatement {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: s.resource as PermissionStatement["resource"],
    action: s.action as PermissionStatement["action"],
    resourceId: s.resourceId ?? "*",
  }
}

export function useCustomerPayments(orgId: string) {
  const query = useListCustomerPayments(orgId)
  const payments = useMemo(() => (query.data?.data?.items ?? NO_PAYMENTS) as CustomerPaymentDto[], [query.data])
  return { payments, isLoading: query.isLoading, error: query.error }
}

export function useCustomerPaymentAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) return { canCreatePayment: false, canPostPayment: false, canReversePayment: false, canDeletePayment: false }
    const s: PermissionSnapshot = { isOwner: snapshot.isOwner, statements: (snapshot.statements ?? []).map(normalizeStatement) }
    return {
      canCreatePayment: hasPermission(s, "create:customer-payment"),
      canPostPayment: hasPermission(s, "post:customer-payment"),
      canReversePayment: hasPermission(s, "reverse:customer-payment"),
      canDeletePayment: hasPermission(s, "delete:customer-payment"),
    }
  }, [snapshot])
}

/** A payment changes invoice balances, so refresh the invoice list and every open invoice. */
function useInvalidate(orgId: string) {
  const qc = useQueryClient()
  return async (invoiceId?: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListCustomerPaymentsQueryKey(orgId) }),
      qc.invalidateQueries({ queryKey: getListSalesInvoicesQueryKey(orgId) }),
      invoiceId ? qc.invalidateQueries({ queryKey: getGetSalesInvoiceQueryKey(orgId, invoiceId) }) : Promise.resolve(),
    ])
  }
}

export function useCreatePaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCreateCustomerPayment({ mutation: { onSuccess: () => invalidate() } })
}
export function usePostPaymentMutation(orgId: string, invoiceId?: string) {
  const invalidate = useInvalidate(orgId)
  return usePostCustomerPayment({ mutation: { onSuccess: () => invalidate(invoiceId) } })
}
export function useReversePaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseCustomerPayment({ mutation: { onSuccess: () => invalidate() } })
}
export function useDeletePaymentMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDeleteCustomerPayment({ mutation: { onSuccess: () => invalidate() } })
}
