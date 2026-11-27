/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot, type PermissionStatement } from "@avuny/contracts"

import {
  getGetSalesInvoiceQueryKey,
  getListSalesCreditNotesQueryKey,
  getListSalesInvoicesQueryKey,
  useCreateSalesCreditNote,
  useDeleteSalesCreditNote,
  useGetMyPermissions,
  useListSalesCreditNotes,
  usePostSalesCreditNote,
  useReverseSalesCreditNote,
} from "@/api"

import type { SalesCreditNoteDto } from "./types"

const NO_NOTES: SalesCreditNoteDto[] = []

function normalizeStatement(s: { effect?: string; resource: string; action: string; resourceId?: string }): PermissionStatement {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: s.resource as PermissionStatement["resource"],
    action: s.action as PermissionStatement["action"],
    resourceId: s.resourceId ?? "*",
  }
}

export function useSalesCreditNotes(orgId: string) {
  const query = useListSalesCreditNotes(orgId)
  const notes = useMemo(() => (query.data?.data?.items ?? NO_NOTES) as SalesCreditNoteDto[], [query.data])
  return { notes, isLoading: query.isLoading, error: query.error }
}

export function useSalesCreditNoteAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) return { canCreateNote: false, canPostNote: false, canReverseNote: false, canDeleteNote: false }
    const s: PermissionSnapshot = { isOwner: snapshot.isOwner, statements: (snapshot.statements ?? []).map(normalizeStatement) }
    return {
      canCreateNote: hasPermission(s, "create:sales-credit-note"),
      canPostNote: hasPermission(s, "post:sales-credit-note"),
      canReverseNote: hasPermission(s, "reverse:sales-credit-note"),
      canDeleteNote: hasPermission(s, "delete:sales-credit-note"),
    }
  }, [snapshot])
}

/** A credit note changes invoice balances, so refresh the invoice list and every open invoice. */
function useInvalidate(orgId: string) {
  const qc = useQueryClient()
  return async (invoiceId?: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListSalesCreditNotesQueryKey(orgId) }),
      qc.invalidateQueries({ queryKey: getListSalesInvoicesQueryKey(orgId) }),
      invoiceId ? qc.invalidateQueries({ queryKey: getGetSalesInvoiceQueryKey(orgId, invoiceId) }) : Promise.resolve(),
    ])
  }
}

export function useCreateNoteMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useCreateSalesCreditNote({ mutation: { onSuccess: () => invalidate() } })
}
export function usePostNoteMutation(orgId: string, invoiceId?: string) {
  const invalidate = useInvalidate(orgId)
  return usePostSalesCreditNote({ mutation: { onSuccess: () => invalidate(invoiceId) } })
}
export function useReverseNoteMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useReverseSalesCreditNote({ mutation: { onSuccess: () => invalidate() } })
}
export function useDeleteNoteMutation(orgId: string) {
  const invalidate = useInvalidate(orgId)
  return useDeleteSalesCreditNote({ mutation: { onSuccess: () => invalidate() } })
}
