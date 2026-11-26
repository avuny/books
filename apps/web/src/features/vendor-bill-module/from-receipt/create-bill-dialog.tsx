import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { useCreateBillFromReceiptMutation } from "../vendor-bill-api"

type Props = {
  orgId: string
  receiptId: string | null
  receiptNumber: string
  onClose: () => void
  onCreated: (billId: string) => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** Creates a draft vendor bill prefilled from one posted receipt. */
export function CreateBillFromReceiptDialog({ orgId, receiptId, receiptNumber, onClose, onCreated }: Props) {
  const { t } = useTranslation("vendor-bill")
  const mutation = useCreateBillFromReceiptMutation(orgId)
  const [invoiceNo, setInvoiceNo] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!receiptId) return
    setError(null)
    try {
      const res = await mutation.mutateAsync({
        orgId,
        data: {
          purchaseReceiptId: receiptId,
          supplierInvoiceNumber: invoiceNo.trim() || null,
          invoiceDate,
          dueDate: dueDate || null,
        },
      })
      const id = (res as { data?: { id?: string } }).data?.id
      onClose()
      if (id) onCreated(id)
    } catch (e) {
      setError(parseApiError(e).message || null)
    }
  }

  return (
    <Dialog open={Boolean(receiptId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("ui.fromReceipt.title", { number: receiptNumber })}</DialogTitle>
          <DialogDescription>{error ?? t("ui.fromReceipt.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder={t("ui.fromReceipt.invoiceNumber")} aria-label={t("ui.fromReceipt.invoiceNumber")} />
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} aria-label={t("ui.fromReceipt.invoiceDate")} />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t("ui.fromReceipt.dueDate")} title={t("ui.fromReceipt.dueDate")} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("ui.cancel")}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !invoiceDate}>
            {mutation.isPending ? t("ui.fromReceipt.creating") : t("ui.fromReceipt.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
