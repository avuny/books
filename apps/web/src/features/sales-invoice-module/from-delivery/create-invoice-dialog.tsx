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

import { useCreateInvoiceFromDeliveryMutation } from "../sales-invoice-api"

type Props = {
  orgId: string
  deliveryId: string | null
  deliveryNumber: string
  onClose: () => void
  onCreated: (invoiceId: string) => void
}

const today = () => new Date().toISOString().slice(0, 10)

/** Creates a draft invoice for what one posted delivery has not billed yet. */
export function CreateInvoiceFromDeliveryDialog({ orgId, deliveryId, deliveryNumber, onClose, onCreated }: Props) {
  const { t } = useTranslation("sales-invoice")
  const mutation = useCreateInvoiceFromDeliveryMutation(orgId)
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!deliveryId) return
    setError(null)
    try {
      const res = await mutation.mutateAsync({
        orgId,
        id: deliveryId,
        data: { invoiceDate, dueDate: dueDate || null },
      })
      const id = (res as { data?: { id?: string } }).data?.id
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
          <DialogTitle>{t("ui.fromDelivery.title", { number: deliveryNumber })}</DialogTitle>
          <DialogDescription>{error ?? t("ui.fromDelivery.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} aria-label={t("ui.fromDelivery.invoiceDate")} title={t("ui.fromDelivery.invoiceDate")} />
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label={t("ui.fromDelivery.dueDate")} title={t("ui.fromDelivery.dueDate")} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("ui.cancel")}
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !invoiceDate}>
            {mutation.isPending ? t("ui.fromDelivery.creating") : t("ui.fromDelivery.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
