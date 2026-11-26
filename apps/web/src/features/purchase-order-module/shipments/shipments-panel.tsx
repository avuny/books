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

import type { PurchaseOrderDto } from "../types"
import {
  useCreateShipmentMutation,
  usePostShipmentMutation,
  usePurchaseOrderAbilities,
  usePurchaseShipments,
  useReverseShipmentMutation,
  type ShipmentDto,
} from "../purchase-order-api"
import { buildShipmentPayload, openShipmentLines } from "./build-shipment"

type Props = { orgId: string; order: PurchaseOrderDto }

export function ShipmentsPanel({ orgId, order }: Props) {
  const { t } = useTranslation("purchase-order")
  const abilities = usePurchaseOrderAbilities(orgId)
  const { shipments } = usePurchaseShipments(orgId, order.id)
  const createMutation = useCreateShipmentMutation(orgId, order.id)
  const postMutation = usePostShipmentMutation(orgId, order.id)
  const reverseMutation = useReverseShipmentMutation(orgId, order.id)

  const [creating, setCreating] = useState(false)
  const [reversing, setReversing] = useState<ShipmentDto | null>(null)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState("")
  const [carrier, setCarrier] = useState("")
  const [tracking, setTracking] = useState("")
  const [reference, setReference] = useState("")
  const [qty, setQty] = useState<Record<string, string>>({})

  const open = openShipmentLines(order)
  const canShip =
    ["CONFIRMED", "PARTIALLY_SHIPPED"].includes(order.status) && abilities.canCreateShipment && open.length > 0

  const fail = (e: unknown) => setError(parseApiError(e).message || null)

  const submitCreate = async () => {
    setError(null)
    const built = buildShipmentPayload({ date, carrier, tracking, reference }, open, qty)
    if (!built.ok) return setError(t("shipments.invalidQty"))
    try {
      await createMutation.mutateAsync({ orgId, id: order.id, data: built.data })
      setCreating(false)
      setQty({})
    } catch (e) {
      fail(e)
    }
  }

  const post = async (s: ShipmentDto) => {
    setError(null)
    try {
      await postMutation.mutateAsync({ orgId, id: s.id })
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
        <h2 className="text-sm font-semibold text-foreground">{t("shipments.title")}</h2>
        {canShip ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            {t("shipments.new")}
          </Button>
        ) : null}
      </div>
      {error && !creating && !reversing ? <p className="text-sm text-destructive">{error}</p> : null}
      {shipments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("shipments.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("shipments.number"), t("shipments.date"), t("shipments.carrier"), t("shipments.tracking"), t("shipments.status"), ""].map(
                  (h, i) => (
                    <th key={i} className="px-3 py-2 text-start font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">{s.number}</td>
                  <td className="px-3 py-2">{s.shipmentDate}</td>
                  <td className="px-3 py-2">{s.carrier ?? "—"}</td>
                  <td className="px-3 py-2">{s.trackingNumber ?? "—"}</td>
                  <td className="px-3 py-2">{t(`shipments.statuses.${s.status}`)}</td>
                  <td className="flex gap-2 px-3 py-2">
                    {s.status === "DRAFT" && abilities.canPostShipment ? (
                      <Button size="sm" variant="outline" disabled={postMutation.isPending} onClick={() => post(s)}>
                        {t("shipments.post")}
                      </Button>
                    ) : null}
                    {s.status === "POSTED" && abilities.canReverseShipment ? (
                      <Button size="sm" variant="outline" onClick={() => setReversing(s)}>
                        {t("shipments.reverse")}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("shipments.new")}</DialogTitle>
            <DialogDescription>{error ?? t("shipments.noOpenLines")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("shipments.date")} />
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder={t("shipments.carrier")} aria-label={t("shipments.carrier")} />
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={t("shipments.tracking")} aria-label={t("shipments.tracking")} />
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("shipments.reference")} aria-label={t("shipments.reference")} />
          </div>
          <div className="flex flex-col gap-2">
            {open.map((l) => (
              <div key={l.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{l.itemName ?? l.itemId}</span>
                <span className="text-muted-foreground">
                  {t("shipments.remaining")}: {l.unshippedBaseQty}
                </span>
                <Input
                  className="w-28"
                  value={qty[l.id] ?? ""}
                  onChange={(e) => setQty((m) => ({ ...m, [l.id]: e.target.value }))}
                  placeholder={t("shipments.qty")}
                  aria-label={`${t("shipments.qty")} ${l.itemName ?? ""}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {t("shipments.cancel")}
            </Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? t("shipments.creating") : t("shipments.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reversing)} onOpenChange={(o) => !o && setReversing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("shipments.reverseTitle")}</DialogTitle>
            <DialogDescription>{error ?? t("shipments.reverseDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("shipments.reason")} aria-label={t("shipments.reason")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversing(null)}>
              {t("shipments.cancel")}
            </Button>
            <Button onClick={reverse} disabled={reverseMutation.isPending || !reason.trim()}>
              {t("shipments.reverse")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
