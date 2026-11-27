import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { formatMinorAmount } from "../../purchase-order-module/lib/format-money"
import {
  useCustomerPaymentAbilities,
  useCustomerPayments,
  useDeletePaymentMutation,
  usePostPaymentMutation,
  useReversePaymentMutation,
} from "../customer-payment-api"
import type { CustomerPaymentDto } from "../types"

type Props = { orgId: string }

export function CustomerPaymentList({ orgId }: Props) {
  const { t, i18n } = useTranslation("customer-payment")
  const abilities = useCustomerPaymentAbilities(orgId)
  const { payments, isLoading } = useCustomerPayments(orgId)
  const postMutation = usePostPaymentMutation(orgId)
  const reverseMutation = useReversePaymentMutation(orgId)
  const deleteMutation = useDeletePaymentMutation(orgId)
  const [reversing, setReversing] = useState<CustomerPaymentDto | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(parseApiError(e).message || null)
      return false
    }
  }

  const reverse = async () => {
    if (!reversing) return
    if (await run(() => reverseMutation.mutateAsync({ orgId, id: reversing.id, data: { reason: reason.trim() } }))) {
      setReversing(null)
      setReason("")
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t("ui.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ui.description")}</p>
      </div>
      {error && !reversing ? <p className="text-sm text-destructive">{error}</p> : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ui.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("ui.number"), t("ui.customer"), t("ui.date"), t("ui.method"), t("ui.amount"), t("ui.invoices"), t("ui.status"), ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{p.number}</td>
                  <td className="px-3 py-2">{p.partyName ?? ""}</td>
                  <td className="px-3 py-2">{p.paymentDate}</td>
                  <td className="px-3 py-2">{t(`labels.method.${p.method}`)}</td>
                  <td className="px-3 py-2">{formatMinorAmount(p.amount, p.currency, i18n.language)}</td>
                  <td className="px-3 py-2">{p.allocations.map((a) => a.salesInvoiceNumber ?? a.salesInvoiceId).join(", ")}</td>
                  <td className="px-3 py-2">{t(`labels.status.${p.status}`)}</td>
                  <td className="flex gap-2 px-3 py-2">
                    {p.status === "DRAFT" && abilities.canPostPayment ? (
                      <Button size="sm" variant="outline" disabled={postMutation.isPending} onClick={() => run(() => postMutation.mutateAsync({ orgId, id: p.id }))}>
                        {t("ui.post")}
                      </Button>
                    ) : null}
                    {p.status === "DRAFT" && abilities.canDeletePayment ? (
                      <Button size="sm" variant="outline" disabled={deleteMutation.isPending} onClick={() => run(() => deleteMutation.mutateAsync({ orgId, id: p.id }))}>
                        {t("ui.delete")}
                      </Button>
                    ) : null}
                    {p.status === "POSTED" && abilities.canReversePayment ? (
                      <Button size="sm" variant="outline" onClick={() => setReversing(p)}>
                        {t("ui.reverse")}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={Boolean(reversing)} onOpenChange={(o) => !o && setReversing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ui.reverseTitle")}</DialogTitle>
            <DialogDescription>{error ?? t("ui.reverseDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ui.reason")} aria-label={t("ui.reason")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversing(null)}>{t("ui.cancel")}</Button>
            <Button onClick={reverse} disabled={reverseMutation.isPending || !reason.trim()}>{t("ui.reverse")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
