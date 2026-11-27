import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { ConfirmDialog } from "@workspace/ui/blocks/data-table"
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
  useDeleteInvoiceMutation,
  usePostInvoiceMutation,
  useReverseInvoiceMutation,
  useSalesInvoice,
  useSalesInvoiceAbilities,
} from "../sales-invoice-api"

type Props = { orgId: string; invoiceId: string; onBack: () => void }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || "-"}</dd>
    </div>
  )
}

export function SalesInvoiceDetails({ orgId, invoiceId, onBack }: Props) {
  const { t, i18n } = useTranslation("sales-invoice")
  const { invoice, isLoading } = useSalesInvoice(orgId, invoiceId)
  const abilities = useSalesInvoiceAbilities(orgId)
  const postMutation = usePostInvoiceMutation(orgId)
  const reverseMutation = useReverseInvoiceMutation(orgId)
  const deleteMutation = useDeleteInvoiceMutation(orgId)
  const [dialog, setDialog] = useState<"post" | "reverse" | "delete" | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>
  if (!invoice) return <div className="p-6 text-sm text-muted-foreground">{t("ui.notFound")}</div>

  const money = (v: string) => formatMinorAmount(v, invoice.currency, i18n.language)
  const fail = (e: unknown) => setError(parseApiError(e).message || null)

  const post = async () => {
    setError(null)
    try {
      await postMutation.mutateAsync({ orgId, id: invoice.id })
      setDialog(null)
    } catch (e) {
      fail(e)
    }
  }
  const reverse = async () => {
    setError(null)
    try {
      await reverseMutation.mutateAsync({ orgId, id: invoice.id, data: { reason: reason.trim() } })
      setDialog(null)
      setReason("")
    } catch (e) {
      fail(e)
    }
  }
  const remove = async () => {
    try {
      await deleteMutation.mutateAsync({ orgId, id: invoice.id })
      onBack()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("ui.back")}
          </Button>
          <h1 className="text-xl font-semibold">{invoice.number}</h1>
          <span className="rounded-md border px-2 py-0.5 text-xs">{t(`labels.status.${invoice.status}`)}</span>
          {invoice.paymentStatus ? (
            <span className="rounded-md border px-2 py-0.5 text-xs">{t(`labels.paymentStatus.${invoice.paymentStatus}`)}</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {invoice.status === "DRAFT" && abilities.canPostInvoice ? <Button onClick={() => setDialog("post")}>{t("ui.post")}</Button> : null}
          {invoice.status === "DRAFT" && abilities.canDeleteInvoice ? (
            <Button variant="outline" onClick={() => setDialog("delete")}>{t("ui.delete")}</Button>
          ) : null}
          {invoice.status === "POSTED" && abilities.canReverseInvoice ? (
            <Button variant="outline" onClick={() => setDialog("reverse")}>{t("ui.reverse")}</Button>
          ) : null}
        </div>
      </div>
      {error && !dialog ? <p className="text-sm text-destructive">{error}</p> : null}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label={t("ui.customer")} value={invoice.customerName} />
        <Field label={t("ui.order")} value={invoice.salesOrderNumber} />
        <Field label={t("ui.invoiceDate")} value={invoice.invoiceDate} />
        <Field label={t("ui.dueDate")} value={invoice.dueDate} />
        <Field label={t("ui.paymentTerm")} value={invoice.paymentTermName} />
        <Field label={t("ui.subtotal")} value={money(invoice.subtotal)} />
        <Field label={t("ui.discount")} value={money(invoice.discountAmount)} />
        <Field label={t("ui.tax")} value={money(invoice.taxAmount)} />
        <Field label={t("ui.total")} value={money(invoice.total)} />
        <Field label={t("ui.paid")} value={money(invoice.paidAmount)} />
        <Field label={t("ui.outstanding")} value={money(invoice.outstandingAmount)} />
        <Field label={t("ui.notes")} value={invoice.notes} />
      </dl>
      {invoice.reverseReason ? <p className="text-sm text-muted-foreground">{t("ui.reversedWhy", { reason: invoice.reverseReason })}</p> : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("ui.lines")}</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("ui.item"), t("ui.delivery"), t("ui.qty"), t("ui.unitPrice"), t("ui.net"), t("ui.tax"), t("ui.lineTotal")].map((h) => (
                  <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{l.itemName ?? l.itemId}</td>
                  <td className="px-3 py-2">{l.salesDeliveryNumber ?? ""}</td>
                  <td className="px-3 py-2">{l.quantity} {l.unitSymbol ?? ""}</td>
                  <td className="px-3 py-2">{money(l.unitPrice)}</td>
                  <td className="px-3 py-2">{money(l.netAmount)}</td>
                  <td className="px-3 py-2">{money(l.taxAmount)}</td>
                  <td className="px-3 py-2">{money(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={dialog === "post"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("ui.postTitle")}
        description={error ?? t("ui.postDescription")}
        confirmLabel={t("ui.post")}
        cancelLabel={t("ui.cancel")}
        onConfirm={post}
      />

      <Dialog open={dialog === "reverse"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ui.reverseTitle")}</DialogTitle>
            <DialogDescription>{error ?? t("ui.reverseDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ui.reason")} aria-label={t("ui.reason")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>{t("ui.cancel")}</Button>
            <Button onClick={reverse} disabled={reverseMutation.isPending || !reason.trim()}>{t("ui.reverse")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("ui.deleteTitle")}
        description={t("ui.deleteDescription")}
        confirmLabel={t("ui.delete")}
        cancelLabel={t("ui.cancel")}
        onConfirm={remove}
      />
    </div>
  )
}
