import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"

import { currencyDigits } from "../../purchase-order-module/lib/money-input"
import { formatMinorAmount } from "../../purchase-order-module/lib/format-money"
import { useCreatePaymentMutation, usePostPaymentMutation } from "../customer-payment-api"
import { planPayment, type PayChoice } from "../plan-payment"

type Props = {
  orgId: string
  invoice: { id: string; number: string; partyId: string; currency: string; outstandingAmount: string }
  onClose: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** Receives a payment for one posted invoice: creates the payment with one allocation, then posts it. */
export function InvoicePaymentDialog({ orgId, invoice, onClose }: Props) {
  const { t, i18n } = useTranslation("customer-payment")
  const digits = currencyDigits(invoice.currency)
  const create = useCreatePaymentMutation(orgId)
  const post = usePostPaymentMutation(orgId, invoice.id)
  const [choice, setChoice] = useState<PayChoice>("full")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"cash" | "bank">("bank")
  const [date, setDate] = useState(today())
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    const minor = planPayment(choice, amount, invoice.outstandingAmount, digits)
    if (!minor) return setError(t("ui.dialog.amountInvalid"))
    setBusy(true)
    try {
      const created = await create.mutateAsync({
        orgId,
        data: {
          partyId: invoice.partyId,
          paymentDate: date,
          method,
          referenceNumber: reference.trim() || null,
          allocations: [{ salesInvoiceId: invoice.id, amountMinor: minor }],
        },
      })
      const paymentId = (created as { data?: { id?: string } }).data?.id
      if (paymentId) await post.mutateAsync({ orgId, id: paymentId })
      onClose()
    } catch (e) {
      setError(parseApiError(e).message || null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ui.dialog.title", { number: invoice.number })}</DialogTitle>
          <DialogDescription>
            {error ?? t("ui.dialog.description", { amount: formatMinorAmount(invoice.outstandingAmount, invoice.currency, i18n.language) })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 text-sm">
            {(["full", "partial"] as const).map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input type="radio" name="pay-choice" checked={choice === c} onChange={() => setChoice(c)} />
                {t(`ui.dialog.${c}`)}
              </label>
            ))}
          </div>
          {choice === "partial" ? (
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t("ui.dialog.amount")} aria-label={t("ui.dialog.amount")} />
          ) : null}
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bank")} aria-label={t("ui.dialog.method")}>
            <option value="bank">{t("labels.method.bank")}</option>
            <option value="cash">{t("labels.method.cash")}</option>
          </select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("ui.dialog.date")} />
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("ui.dialog.reference")} aria-label={t("ui.dialog.reference")} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("ui.cancel")}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t("ui.posting") : t("ui.dialog.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
