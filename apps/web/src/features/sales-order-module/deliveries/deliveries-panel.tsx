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

import type { SalesOrderDto } from "../types"
import {
  useCreateDeliveryMutation,
  usePostDeliveryMutation,
  useReverseDeliveryMutation,
  useSalesDeliveries,
  useSalesOrderAbilities,
  type DeliveryDto,
} from "../sales-order-api"
import { formatMinorAmount } from "../lib"
import { buildDeliveryPayload, openDeliveryLines, openQtyInUnit } from "./build-delivery"

type Props = { orgId: string; order: SalesOrderDto }

export function DeliveriesPanel({ orgId, order }: Props) {
  const { t } = useTranslation("sales-delivery")
  const abilities = useSalesOrderAbilities(orgId)
  const { deliveries } = useSalesDeliveries(orgId, order.id)
  const createMutation = useCreateDeliveryMutation(orgId, order.id)
  const postMutation = usePostDeliveryMutation(orgId, order.id)
  const reverseMutation = useReverseDeliveryMutation(orgId, order.id)

  const [creating, setCreating] = useState(false)
  const [reversing, setReversing] = useState<DeliveryDto | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState("")
  const [carrier, setCarrier] = useState("")
  const [tracking, setTracking] = useState("")
  const [rows, setRows] = useState<Record<string, string>>({})

  const open = openDeliveryLines(order)
  const canDeliver = order.status === "CONFIRMED" && abilities.canCreateDelivery && open.length > 0

  const fail = (e: unknown) => setError(parseApiError(e).message || null)

  const startCreate = () => {
    setError(null)
    // Prefill with what is still open so a full delivery is one click.
    setRows(Object.fromEntries(open.map((l) => [l.id, openQtyInUnit(l)])))
    setCreating(true)
  }

  const submitCreate = async () => {
    setError(null)
    const built = buildDeliveryPayload({ date, carrier, trackingNumber: tracking, notes: "" }, open, rows)
    if (!built.ok) return setError(built.reason === "empty" ? t("ui.nothingToDeliver") : t("ui.invalidQty"))
    try {
      await createMutation.mutateAsync({ orgId, id: order.id, data: built.data })
      setCreating(false)
      setRows({})
    } catch (e) {
      fail(e)
    }
  }

  const post = async (d: DeliveryDto) => {
    setError(null)
    try {
      await postMutation.mutateAsync({ orgId, id: d.id })
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
        {canDeliver ? (
          <Button size="sm" onClick={startCreate}>
            {t("ui.new")}
          </Button>
        ) : null}
      </div>
      {error && !creating && !reversing ? <p className="text-sm text-destructive">{error}</p> : null}
      {deliveries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ui.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("ui.number"), t("ui.date"), t("ui.cost"), t("ui.status"), ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2">{d.number}</td>
                  <td className="px-3 py-2">{d.deliveryDate}</td>
                  <td className="px-3 py-2">{formatMinorAmount(d.totalCost, d.currency)}</td>
                  <td className="px-3 py-2">{t(`labels.status.${d.status}`)}</td>
                  <td className="flex gap-2 px-3 py-2">
                    {d.status === "DRAFT" && abilities.canPostDelivery ? (
                      <Button size="sm" variant="outline" disabled={postMutation.isPending} onClick={() => post(d)}>
                        {t("ui.post")}
                      </Button>
                    ) : null}
                    {d.status === "POSTED" && abilities.canReverseDelivery ? (
                      <Button size="sm" variant="outline" onClick={() => setReversing(d)}>
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

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("ui.new")}</DialogTitle>
            <DialogDescription>{error ?? t("ui.noOpenLines")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("ui.date")} />
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={t("ui.carrier")} aria-label={t("ui.carrier")} />
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={t("ui.tracking")} aria-label={t("ui.tracking")} />
          </div>
          <div className="flex flex-col gap-3">
            {open.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{l.itemName ?? l.itemId}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("ui.open")}: {openQtyInUnit(l)} {l.unitSymbol ?? ""}
                  </span>
                </div>
                <Input
                  className="w-28"
                  value={rows[l.id] ?? ""}
                  onChange={(e) => setRows((m) => ({ ...m, [l.id]: e.target.value }))}
                  placeholder={t("ui.quantity")}
                  aria-label={`${t("ui.quantity")} ${l.itemName ?? ""}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t("ui.cancel")}
            </Button>
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
