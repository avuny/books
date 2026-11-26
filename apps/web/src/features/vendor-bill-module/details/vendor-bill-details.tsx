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
  useDeleteBillMutation,
  useReverseBillMutation,
  useVendorBill,
  useVendorBillAbilities,
} from "../vendor-bill-api"
import { BillPaymentDialog } from "./payment-dialog"

type Props = { orgId: string; billId: string; onBack: () => void }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || "-"}</dd>
    </div>
  )
}

export function VendorBillDetails({ orgId, billId, onBack }: Props) {
  const { t, i18n } = useTranslation("vendor-bill")
  const { t: tp } = useTranslation("vendor-payment")
  const { bill, isLoading } = useVendorBill(orgId, billId)
  const abilities = useVendorBillAbilities(orgId)
  const reverseMutation = useReverseBillMutation(orgId)
  const deleteMutation = useDeleteBillMutation(orgId)
  const [dialog, setDialog] = useState<"post" | "pay" | "reverse" | "delete" | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>
  if (!bill) return <div className="p-6 text-sm text-muted-foreground">{t("ui.notFound")}</div>

  const money = (v: string) => formatMinorAmount(v, bill.currency, i18n.language)
  const hasOutstanding = BigInt(bill.outstandingAmount) > 0n
  const fail = (e: unknown) => setError(parseApiError(e).message || null)

  const reverse = async () => {
    setError(null)
    try {
      await reverseMutation.mutateAsync({ orgId, id: bill.id, data: { reason: reason.trim() } })
      setDialog(null)
      setReason("")
    } catch (e) {
      fail(e)
    }
  }
  const remove = async () => {
    try {
      await deleteMutation.mutateAsync({ orgId, id: bill.id })
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
          <h1 className="text-xl font-semibold">{bill.number}</h1>
          <span className="rounded-md border px-2 py-0.5 text-xs">{t(`labels.status.${bill.status}`)}</span>
          {bill.paymentStatus ? (
            <span className="rounded-md border px-2 py-0.5 text-xs">{tp(`labels.paymentStatus.${bill.paymentStatus}`)}</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {bill.status === "DRAFT" && abilities.canPostBill ? <Button onClick={() => setDialog("post")}>{t("ui.post")}</Button> : null}
          {bill.status === "DRAFT" && abilities.canDeleteBill ? (
            <Button variant="outline" onClick={() => setDialog("delete")}>{t("ui.delete")}</Button>
          ) : null}
          {bill.status === "POSTED" && hasOutstanding && abilities.canCreatePayment && abilities.canPostPayment ? (
            <Button onClick={() => setDialog("pay")}>{t("ui.payDialog.open")}</Button>
          ) : null}
          {bill.status === "POSTED" && abilities.canReverseBill ? (
            <Button variant="outline" onClick={() => setDialog("reverse")}>{t("ui.reverse")}</Button>
          ) : null}
        </div>
      </div>
      {error && !dialog ? <p className="text-sm text-destructive">{error}</p> : null}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label={t("ui.supplier")} value={bill.partyName} />
        <Field label={t("ui.invoiceNo")} value={bill.supplierInvoiceNumber} />
        <Field label={t("ui.invoiceDate")} value={bill.invoiceDate} />
        <Field label={t("ui.dueDate")} value={bill.dueDate} />
        <Field label={t("ui.paymentTerm")} value={bill.paymentTermName} />
        <Field label={t("ui.total")} value={money(bill.total)} />
        <Field label={t("ui.paid")} value={money(bill.paidAmount)} />
        <Field label={t("ui.outstanding")} value={money(bill.outstandingAmount)} />
        <Field label={t("ui.receivedValue")} value={money(bill.receivedValue)} />
        <Field label={t("ui.variance")} value={money(bill.priceVariance)} />
        <Field label={t("ui.notes")} value={bill.notes} />
      </dl>
      {bill.reverseReason ? <p className="text-sm text-muted-foreground">{t("ui.reversedWhy", { reason: bill.reverseReason })}</p> : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("ui.lines")}</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("ui.item"), t("ui.receipt"), t("ui.qty"), t("ui.net"), t("ui.tax"), t("ui.lineTotal")].map((h) => (
                  <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{l.itemName ?? l.itemId}</td>
                  <td className="px-3 py-2">{l.purchaseReceiptNumber ?? ""}</td>
                  <td className="px-3 py-2">{l.billedQty} {l.unitSymbol ?? ""}</td>
                  <td className="px-3 py-2">{money(l.netAmount)}</td>
                  <td className="px-3 py-2">{money(l.taxAmount)}</td>
                  <td className="px-3 py-2">{money(l.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dialog === "post" || dialog === "pay" ? (
        <BillPaymentDialog
          orgId={orgId}
          bill={bill}
          mode={dialog}
          canPay={abilities.canCreatePayment && abilities.canPostPayment}
          onClose={() => setDialog(null)}
        />
      ) : null}

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
