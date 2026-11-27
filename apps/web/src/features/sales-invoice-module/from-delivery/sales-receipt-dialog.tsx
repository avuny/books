import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"

import { useSalesReceiptMutation } from "../sales-invoice-api"

type Props = {
  orgId: string
  deliveryId: string | null
  deliveryNumber: string
  onClose: () => void
  onCreated: (invoiceId: string) => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** POS style: invoices the delivery, posts the invoice and records a posted payment in one step. */
export function SalesReceiptDialog({ orgId, deliveryId, deliveryNumber, onClose, onCreated }: Props) {
  const { t } = useTranslation("sales-invoice")
  const mutation = useSalesReceiptMutation(orgId)
  const [date, setDate] = useState(today())
  const [method, setMethod] = useState<"cash" | "bank">("cash")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!deliveryId) return
    setError(null)
    try {
      const res = await mutation.mutateAsync({ orgId, id: deliveryId, data: { invoiceDate: date, method } })
      const id = (res as { data?: { invoice?: { id?: string } } }).data?.invoice?.id
      onClose()
      if (id) onCreated(id)
    } catch (e) {
      setError(parseApiError(e).message || null)
    }
  }

  return (
    <Dialog open={Boolean(deliveryId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ui.receipt.title", { number: deliveryNumber })}</DialogTitle>
          <DialogDescription>{error ?? t("ui.receipt.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("ui.receipt.date")} title={t("ui.receipt.date")} />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bank")} aria-label={t("ui.receipt.method")}>
            <option value="cash">{t("ui.receipt.cash")}</option>
            <option value="bank">{t("ui.receipt.bank")}</option>
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("ui.cancel")}</Button>
          <Button onClick={submit} disabled={mutation.isPending || !date}>
            {mutation.isPending ? t("ui.receipt.creating") : t("ui.receipt.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
