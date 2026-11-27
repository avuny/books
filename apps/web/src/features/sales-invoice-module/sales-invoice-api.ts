/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot, type PermissionStatement } from "@avuny/contracts"

import {
  getGetSalesInvoiceQueryKey,
  getListSalesInvoicesQueryKey,
  useCreateSalesInvoiceFromDelivery,
  useGetArAging,
  useGetArReconciliation,
  useGetCustomerStatement,
  useDeleteSalesInvoice,
  useGetMyPermissions,
  useGetSalesInvoice,
  useListSalesInvoices,
  usePostSalesInvoice,
  useReverseSalesInvoice,
} from "@/api"

import type { ArAgingResponse, ArReconciliationResponse, CustomerStatementResponse, SalesInvoiceDto } from "./types"

const NO_INVOICES: SalesInvoiceDto[] = []

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

export function useSalesInvoices(orgId: string) {
  const query = useListSalesInvoices(orgId)
  const invoices = useMemo(
    () => (query.data?.data?.items ?? NO_INVOICES) as SalesInvoiceDto[],
    [query.data]
  )
  return { invoices, isLoading: query.isLoading, error: query.error }
}

export function useSalesInvoice(orgId: string, id: string) {
  const query = useGetSalesInvoice(orgId, id)
  const invoice = useMemo<SalesInvoiceDto | null>(
    () => (query.data?.data ? (query.data.data as SalesInvoiceDto) : null),
    [query.data]
  )
  return { invoice, isLoading: query.isLoading, error: query.error }
}

export function useSalesInvoiceAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) {
      return { canCreateInvoice: false, canPostInvoice: false, canReverseInvoice: false, canDeleteInvoice: false }
    }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: (snapshot.statements ?? []).map(normalizeStatement),
    }
    return {
      canCreateInvoice: hasPermission(s, "create:sales-invoice"),
      canPostInvoice: hasPermission(s, "post:sales-invoice"),
      canReverseInvoice: hasPermission(s, "reverse:sales-invoice"),
      canDeleteInvoice: hasPermission(s, "delete:sales-invoice"),
    }
  }, [snapshot])
}

function useInvalidate(orgId: string) {
  const qc = useQueryClient()
  return async (invoiceId?: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListSalesInvoicesQueryKey(orgId) }),
      invoiceId
        ? qc.invalidateQueries({ queryKey: getGetSalesInvoiceQueryKey(orgId, invoiceId) })
        : Promise.resolve(),
    ])
  }
}

export function useCreateInvoiceFromDeliveryMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCreateSalesInvoiceFromDelivery({ mutation: { onSuccess: () => invalidate() } })
}
export function usePostInvoiceMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return usePostSalesInvoice({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useReverseInvoiceMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseSalesInvoice({ mutation: { onSuccess: (_r, v) => invalidate(v.id) } })
}
export function useDeleteInvoiceMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDeleteSalesInvoice({ mutation: { onSuccess: () => invalidate() } })
}

export function useArAging(orgId: string) {
  const query = useGetArAging(orgId)
  const aging = (query.data?.data ?? null) as ArAgingResponse | null
  return { aging, isLoading: query.isLoading, error: query.error }
}

export function useArReconciliation(orgId: string) {
  const query = useGetArReconciliation(orgId)
  const reconciliation = (query.data?.data ?? null) as ArReconciliationResponse | null
  return { reconciliation, isLoading: query.isLoading, error: query.error }
}

export function useCustomerStatement(orgId: string, params: { partyId: string; from?: string; to?: string } | null) {
  const query = useGetCustomerStatement(
    orgId,
    { partyId: params?.partyId ?? "", from: params?.from || undefined, to: params?.to || undefined },
    { query: { enabled: Boolean(params) } }
  )
  const statement = (query.data?.data ?? null) as CustomerStatementResponse | null
  return { statement, isLoading: query.isLoading && Boolean(params), error: query.error }
}
