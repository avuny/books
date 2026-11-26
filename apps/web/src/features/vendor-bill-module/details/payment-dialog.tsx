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

import { currencyDigits } from "../../purchase-order-module/lib/money-input"
import { formatMinorAmount } from "../../purchase-order-module/lib/format-money"
import { planPayment, type PayChoice } from "../build-payment"
import {
  useCreatePaymentMutation,
  usePostBillMutation,
  usePostPaymentMutation,
} from "../vendor-bill-api"
import type { VendorBillDto } from "../types"

type Props = {
  orgId: string
  bill: VendorBillDto
  /** "post" posts a draft bill first (Pay later / Already paid / Partially paid); "pay" pays a posted bill. */
  mode: "post" | "pay"
  canPay: boolean
  onClose: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

export function BillPaymentDialog({ orgId, bill, mode, canPay, onClose }: Props) {
  const { t, i18n } = useTranslation("vendor-bill")
  const { t: tp } = useTranslation("vendor-payment")
  const digits = currencyDigits(bill.currency)
  const postBill = usePostBillMutation(orgId)
  const createPayment = useCreatePaymentMutation(orgId)
  const postPayment = usePostPaymentMutation(orgId)

  const [choice, setChoice] = useState<PayChoice>(mode === "pay" ? "partial" : "later")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"cash" | "bank">("bank")
  const [date, setDate] = useState(today())
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const limit = mode === "pay" ? bill.outstandingAmount : bill.total
  const showPayFields = choice !== "later"
  const choices: PayChoice[] = mode === "pay" ? ["paid", "partial"] : canPay ? ["later", "paid", "partial"] : ["later"]

  const submit = async () => {
    setError(null)
    const plan = planPayment(choice, amount, limit, digits)
    if (!plan.ok) return setError(t(mode === "pay" ? "ui.payDialog.amountInvalid" : "ui.postDialog.amountInvalid"))
    setBusy(true)
    try {
      if (mode === "post") await postBill.mutateAsync({ orgId, id: bill.id })
      if (plan.amountMinor) {
        const created = await createPayment.mutateAsync({
          orgId,
          data: {
            partyId: bill.partyId,
            paymentDate: date,
            method,
            referenceNumber: reference.trim() || null,
            allocations: [{ vendorBillId: bill.id, amountMinor: plan.amountMinor }],
          },
        })
        const paymentId = (created as { data?: { id?: string } }).data?.id
        if (paymentId) await postPayment.mutateAsync({ orgId, id: paymentId })
      }
      onClose()
    } catch (e) {
      setError(parseApiError(e).message || null)
    } finally {
      setBusy(false)
    }
  }

  const key = mode === "pay" ? "payDialog" : "postDialog"
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`ui.${key}.title`, { number: bill.number })}</DialogTitle>
          <DialogDescription>
            {error ??
              (mode === "pay"
                ? t("ui.payDialog.description", { amount: formatMinorAmount(bill.outstandingAmount, bill.currency, i18n.language) })
                : t("ui.postDialog.description"))}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {mode === "post" ? (
            <div className="flex flex-col gap-2">
              {choices.map((c) => (
                <label key={c} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="pay-choice" checked={choice === c} onChange={() => setChoice(c)} className="mt-1" />
                  <span>
                    <span className="font-medium">{t(`ui.postDialog.${c}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`ui.postDialog.${c}Hint`)}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
          {showPayFields ? (
            <div className="flex flex-col gap-2">
              {choice === "partial" ? (
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t(`ui.${key}.amount`)} aria-label={t(`ui.${key}.amount`)} />
              ) : null}
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as "cash" | "bank")} aria-label={t(`ui.${key}.method`)}>
                <option value="bank">{tp("labels.method.bank")}</option>
                <option value="cash">{tp("labels.method.cash")}</option>
              </select>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t(`ui.${key}.date`)} />
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t(`ui.${key}.reference`)} aria-label={t(`ui.${key}.reference`)} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("ui.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? t("ui.posting") : t(`ui.${key}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
