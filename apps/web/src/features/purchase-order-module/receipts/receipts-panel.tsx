import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { QuickReceiveError, quickReceive } from "./quick-receive"
import { CreateBillFromReceiptDialog, useVendorBillAbilities } from "../../vendor-bill-module"
import type { PurchaseOrderDto } from "../types"
import {
  useCreateReceiptMutation,
  usePostReceiptMutation,
  usePurchaseOrderAbilities,
  usePurchaseReceipts,
  useReverseReceiptMutation,
  type ReceiptDto,
} from "../purchase-order-api"
import { formatMinorAmount } from "../lib"
import { buildReceiptPayload, openReceiptLines, type ReceiptLineInput } from "./build-receipt"

type Props = { orgId: string; order: PurchaseOrderDto }

const EMPTY: ReceiptLineInput = { received: "", rejected: "", reason: "", direct: false, expiresOn: "" }

export function ReceiptsPanel({ orgId, order }: Props) {
  const { t } = useTranslation("purchase-receipt")
  const abilities = usePurchaseOrderAbilities(orgId)
  const billAbilities = useVendorBillAbilities(orgId)
  const navigate = useNavigate()
  const [billing, setBilling] = useState<ReceiptDto | null>(null)
  const { receipts } = usePurchaseReceipts(orgId, order.id)
  const createMutation = useCreateReceiptMutation(orgId, order.id)
  const [quickBusy, setQuickBusy] = useState(false)
  const queryClient = useQueryClient()
  const [quickMethod, setQuickMethod] = useState<"cash" | "bank">("bank")
  const postMutation = usePostReceiptMutation(orgId, order.id)
  const reverseMutation = useReverseReceiptMutation(orgId, order.id)

  const [creating, setCreating] = useState(false)
  const [reversing, setReversing] = useState<ReceiptDto | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState("")
  const [reference, setReference] = useState("")
  const [rows, setRows] = useState<Record<string, ReceiptLineInput>>({})

  const open = openReceiptLines(order)
  const canReceive =
    ["CONFIRMED", "PARTIALLY_SHIPPED", "IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(order.status) &&
    abilities.canCreateReceipt &&
    open.length > 0

  const fail = (e: unknown) => setError(parseApiError(e).message || null)
  const setRow = (id: string, patch: Partial<ReceiptLineInput>) =>
    setRows((m) => ({ ...m, [id]: { ...(m[id] ?? EMPTY), ...patch } }))

  const submitCreate = async () => {
    setError(null)
    const built = buildReceiptPayload({ date, reference, notes: "" }, open, rows)
    if (!built.ok) {
      return setError(built.reason === "rejectionReason" ? t("ui.reasonRequired") : t("ui.invalidQty"))
    }
    try {
      await createMutation.mutateAsync({ orgId, id: order.id, data: built.data })
      setCreating(false)
      setRows({})
    } catch (e) {
      fail(e)
    }
  }

  const submitQuick = async () => {
    setError(null)
    const built = buildReceiptPayload({ date, reference, notes: "" }, open, rows)
    if (!built.ok) {
      return setError(built.reason === "rejectionReason" ? t("ui.reasonRequired") : t("ui.invalidQty"))
    }
    setQuickBusy(true)
    try {
      await quickReceive(orgId, order.id, built.data, quickMethod)
      setCreating(false)
      setRows({})
    } catch (e) {
      const cause = e instanceof QuickReceiveError ? e.cause : e
      const message = parseApiError(cause).message || ""
      setError(t(
          e instanceof QuickReceiveError && e.ambiguous
            ? "ui.quick.stepUnknown"
            : e instanceof QuickReceiveError && e.leftover
              ? "ui.quick.stepFailedUndo"
              : "ui.quick.stepFailed",
          { message }
        ))
    } finally {
      setQuickBusy(false)
      await queryClient.invalidateQueries()
    }
  }

  const post = async (r: ReceiptDto) => {
    setError(null)
    try {
      await postMutation.mutateAsync({ orgId, id: r.id })
    } catch (e) {
      fail(e)
    }
  }

  const reverse = async () => {
    if (!reversing) return
    setError(null)
    try {
      await reverseMutation.mutateAsync({ orgId, id: reversing.id, data: { reason: reason.trim() } })
      setReversing(null)
      setReason("")
    } catch (e) {
      fail(e)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("ui.title")}</h2>
        {canReceive ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            {t("ui.new")}
          </Button>
        ) : null}
      </div>
      {error && !creating && !reversing ? <p className="text-sm text-destructive">{error}</p> : null}
      {receipts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ui.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("ui.number"), t("ui.date"), t("ui.value"), t("ui.status"), t("ui.bill"), ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.number}</td>
                  <td className="px-3 py-2">{r.receiptDate}</td>
                  <td className="px-3 py-2">{formatMinorAmount(r.totalValue, r.currency)}</td>
                  <td className="px-3 py-2">{t(`labels.status.${r.status}`)}</td>
                  <td className="px-3 py-2">{t(`labels.billStatus.${r.billStatus}`)}</td>
                  <td className="flex gap-2 px-3 py-2">
                    {r.status === "DRAFT" && abilities.canPostReceipt ? (
                      <Button size="sm" variant="outline" disabled={postMutation.isPending} onClick={() => post(r)}>
                        {t("ui.post")}
                      </Button>
                    ) : null}
                    {r.status === "POSTED" && r.billStatus !== "BILLED" && billAbilities.canCreateBill ? (
                      <Button size="sm" variant="outline" onClick={() => setBilling(r)}>
                        {t("ui.createBill")}
                      </Button>
                    ) : null}
                    {r.status === "POSTED" && abilities.canReverseReceipt ? (
                      <Button size="sm" variant="outline" onClick={() => setReversing(r)}>
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

      <CreateBillFromReceiptDialog
        orgId={orgId}
        receiptId={billing?.id ?? null}
        receiptNumber={billing?.number ?? ""}
        onClose={() => setBilling(null)}
        onCreated={(billId) =>
          navigate({ to: "/organization/$orgId/vendor-bills/$billId", params: { orgId, billId } })
        }
      />

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("ui.new")}</DialogTitle>
            <DialogDescription>{error ?? t("ui.noOpenLines")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("ui.date")} />
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("ui.reference")} aria-label={t("ui.reference")} />
          </div>
          <div className="flex flex-col gap-3">
            {open.map((l) => {
              const row = rows[l.id] ?? EMPTY
              const canDirect = Number(l.unshippedBaseQty) > 0
              return (
                <div key={l.id} className="flex flex-col gap-2 rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{l.itemName ?? l.itemId}</span>
                    <span className="text-muted-foreground">
                      {t("ui.inTransit")}: {l.inTransitBaseQty} · {t("ui.unshipped")}: {l.unshippedBaseQty}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input className="w-28" value={row.received} onChange={(e) => setRow(l.id, { received: e.target.value })} placeholder={t("ui.received")} aria-label={`${t("ui.received")} ${l.itemName ?? ""}`} />
                    <Input className="w-28" value={row.rejected} onChange={(e) => setRow(l.id, { rejected: e.target.value })} placeholder={t("ui.rejected")} aria-label={`${t("ui.rejected")} ${l.itemName ?? ""}`} />
                    {Number(row.rejected) > 0 ? (
                      <Input className="min-w-40 flex-1" value={row.reason} onChange={(e) => setRow(l.id, { reason: e.target.value })} placeholder={t("ui.rejectionReason")} aria-label={t("ui.rejectionReason")} />
                    ) : null}
                    <Input className="w-40" type="date" value={row.expiresOn} onChange={(e) => setRow(l.id, { expiresOn: e.target.value })} aria-label={`${t("ui.expiryDate")} ${l.itemName ?? ""}`} title={t("ui.expiryDate")} />
                    {canDirect ? (
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input type="checkbox" checked={row.direct} onChange={(e) => setRow(l.id, { direct: e.target.checked })} />
                        {t("ui.direct")}
                      </label>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t("ui.cancel")}
            </Button>
            {abilities.canPostReceipt && billAbilities.canCreateBill && billAbilities.canPostBill ? (
              <>
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={quickMethod} onChange={(e) => setQuickMethod(e.target.value as "cash" | "bank")} aria-label={t("ui.quick.method")}>
                  <option value="bank">{t("ui.quick.bank")}</option>
                  <option value="cash">{t("ui.quick.cash")}</option>
                </select>
                <Button variant="outline" onClick={submitQuick} disabled={quickBusy || createMutation.isPending}>
                  {quickBusy ? t("ui.quick.creating") : t("ui.quick.confirm")}
                </Button>
              </>
            ) : null}
            <Button onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? t("ui.creating") : t("ui.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reversing)} onOpenChange={(o) => !o && setReversing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ui.reverseTitle")}</DialogTitle>
            <DialogDescription>{error ?? t("ui.reverseDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ui.reason")} aria-label={t("ui.reason")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversing(null)}>
              {t("ui.cancel")}
            </Button>
            <Button onClick={reverse} disabled={reverseMutation.isPending || !reason.trim()}>
              {t("ui.reverse")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
