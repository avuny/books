import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"

import { currencyDigits, toMinorUnits } from "../../purchase-order-module/lib/money-input"
import { formatMinorAmount } from "../../purchase-order-module/lib/format-money"
import { useCreateNoteMutation, usePostNoteMutation } from "../sales-credit-note-api"

type Props = {
  orgId: string
  invoice: { id: string; number: string; currency: string; outstandingAmount: string }
  onClose: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** Issues a credit note for one posted invoice: creates the draft, then posts it. */
export function InvoiceCreditNoteDialog({ orgId, invoice, onClose }: Props) {
  const { t, i18n } = useTranslation("sales-credit-note")
  const digits = currencyDigits(invoice.currency)
  const create = useCreateNoteMutation(orgId)
  const post = usePostNoteMutation(orgId, invoice.id)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(today())
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    const minor = toMinorUnits(amount, digits)
    if (minor === null || BigInt(minor) <= 0n || BigInt(minor) > BigInt(invoice.outstandingAmount)) return setError(t("ui.dialog.amountInvalid"))
    if (!reason.trim()) return setError(t("ui.dialog.reasonRequired"))
    setBusy(true)
    try {
      const created = await create.mutateAsync({ orgId, data: { salesInvoiceId: invoice.id, creditDate: date, amountMinor: minor, reason: reason.trim() } })
      const id = (created as { data?: { id?: string } }).data?.id
      if (id) await post.mutateAsync({ orgId, id })
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
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t("ui.dialog.amount")} aria-label={t("ui.dialog.amount")} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("ui.dialog.date")} />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ui.dialog.reason")} aria-label={t("ui.dialog.reason")} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("ui.cancel")}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? t("ui.saving") : t("ui.dialog.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
