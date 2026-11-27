import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { SALES_ORDER_DEFAULT_RESERVATION_POLICY, SALES_ORDER_RESERVATION_POLICIES, type SalesOrderReservationPolicy } from "@avuny/contracts"
import { SalesOrderStatusBadge } from "../components"
import { DeliveriesPanel } from "../deliveries"
import { bpsToPercent, formatMinorAmount, useSalesOrderLabels } from "../lib"
import {
  useCancelSalesOrderMutation,
  useCloseSalesOrderMutation,
  useConfirmSalesOrderMutation,
  useSalesOrder,
  useSalesOrderAbilities,
} from "../sales-order-api"

type Props = { orgId: string; orderId: string; onBack: () => void; onEdit?: () => void }
type Action = "confirm" | "close" | "cancel" | null

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}

export function SalesOrderDetails({ orgId, orderId, onBack, onEdit }: Props) {
  const { t, i18n } = useTranslation("sales-order")
  const { order, isLoading } = useSalesOrder(orgId, orderId)
  const abilities = useSalesOrderAbilities(orgId)
  const { getStatusLabel } = useSalesOrderLabels()
  const [action, setAction] = useState<Action>(null)
  const [reason, setReason] = useState("")
  const [policy, setPolicy] = useState<SalesOrderReservationPolicy>(SALES_ORDER_DEFAULT_RESERVATION_POLICY)
  const [error, setError] = useState<string | null>(null)

  const confirmMutation = useConfirmSalesOrderMutation(orgId)
  const closeMutation = useCloseSalesOrderMutation(orgId)
  const cancelMutation = useCancelSalesOrderMutation(orgId)
  const busy = confirmMutation.isPending || closeMutation.isPending || cancelMutation.isPending

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>
  if (!order) return <div className="p-6 text-sm text-muted-foreground">{t("details.notFound")}</div>

  const money = (v: string) => formatMinorAmount(v, order.currency, i18n.language)
  const open = order.status === "CONFIRMED"
  const canCancel = (order.status === "DRAFT" || order.status === "CONFIRMED") && abilities.canCancel

  const reset = () => {
    setAction(null)
    setReason("")
    setError(null)
    setPolicy(SALES_ORDER_DEFAULT_RESERVATION_POLICY)
  }

  const submit = async () => {
    setError(null)
    try {
      if (action === "confirm") await confirmMutation.mutateAsync({ orgId, id: order.id, data: { policy } })
      if (action === "close") await closeMutation.mutateAsync({ orgId, id: order.id, data: { reason: reason.trim() } })
      if (action === "cancel")
        await cancelMutation.mutateAsync({ orgId, id: order.id, data: reason.trim() ? { reason: reason.trim() } : {} })
      reset()
    } catch (e) {
      setError(parseApiError(e).message || null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("actions.back")}
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">
            {t("details.title")} {order.number}
          </h1>
          <SalesOrderStatusBadge status={order.status} label={getStatusLabel(order.status)} />
        </div>
        <div className="flex gap-2">
          {order.status === "DRAFT" && abilities.canUpdate && onEdit ? (
            <Button variant="outline" onClick={onEdit}>{t("actions.edit")}</Button>
          ) : null}
          {order.status === "DRAFT" && abilities.canConfirm ? (
            <Button onClick={() => setAction("confirm")}>{t("actions.confirm")}</Button>
          ) : null}
          {open && abilities.canClose ? (
            <Button variant="outline" onClick={() => setAction("close")}>{t("actions.close")}</Button>
          ) : null}
          {canCancel ? (
            <Button variant="outline" onClick={() => setAction("cancel")}>{t("actions.cancel")}</Button>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("details.customer")} value={order.partyName ?? "—"} />
        <Field label={t("details.orderDate")} value={order.orderDate} />
        <Field label={t("details.expectedDelivery")} value={order.requestedDeliveryDate ?? "—"} />
        <Field label={t("details.paymentTerm")} value={order.paymentTermName ?? t("details.none")} />
        <Field label={t("details.warehouse")} value={order.warehouseName ?? t("details.none")} />
        <Field label={t("details.customerReference")} value={order.customerReference ?? "—"} />
        {order.closeReason ? <Field label={t("details.closeReason")} value={order.closeReason} /> : null}
        {order.notes ? <Field label={t("details.notes")} value={order.notes} /> : null}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t("details.lines")}</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs text-muted-foreground">
              <tr>
                {[
                  t("lineFields.item"),
                  t("lineFields.location"),
                  t("lineFields.ordered"),
                  t("lineFields.reserved"),
                  t("lineFields.delivered"),
                  t("lineFields.unreserved"),
                  t("lineFields.unitPrice"),
                  t("details.discountRate"),
                  t("lineFields.net"),
                  t("details.taxRate"),
                  t("details.lineTotal"),
                ].map((label) => (
                  <th key={label} className="px-3 py-2 text-start font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{l.itemName ?? l.itemId}</td>
                  <td className="px-3 py-2">{l.locationName ?? l.locationCode ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{l.orderedQty} {l.unitSymbol ?? ""}</td>
                  <td className="px-3 py-2 tabular-nums">{l.reservedBaseQty}</td>
                  <td className="px-3 py-2 tabular-nums">{l.deliveredBaseQty}</td>
                  <td className="px-3 py-2 tabular-nums">{l.unreservedOpenBaseQty}</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.unitPrice)}</td>
                  <td className="px-3 py-2 tabular-nums">{bpsToPercent(l.discountRateBps)}%</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.lineNetAmount)}</td>
                  <td className="px-3 py-2 tabular-nums">{bpsToPercent(l.taxRateBps)}%</td>
                  <td className="px-3 py-2 tabular-nums">{money(l.lineTotalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ms-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
          <dt className="text-muted-foreground">{t("details.subtotal")}</dt>
          <dd className="text-end tabular-nums">{money(order.subtotalAmount)}</dd>
          <dt className="text-muted-foreground">{t("details.discount")}</dt>
          <dd className="text-end tabular-nums">{money(order.discountAmount)}</dd>
          <dt className="text-muted-foreground">{t("details.tax")}</dt>
          <dd className="text-end tabular-nums">{money(order.taxAmount)}</dd>
          <dt className="font-medium">{t("details.total")}</dt>
          <dd className="text-end font-medium tabular-nums">{money(order.totalAmount)}</dd>
        </dl>
      </section>

      <DeliveriesPanel orgId={orgId} order={order} />

      <Dialog open={action === "confirm"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("actions.confirmTitle")}</DialogTitle>
            <DialogDescription>{error ?? t("actions.confirmDescription")}</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{t("actions.reservationPolicy")}</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={policy}
              onChange={(e) => setPolicy(e.target.value as SalesOrderReservationPolicy)}
            >
              {SALES_ORDER_RESERVATION_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {t(`labels.reservationPolicy.${p}`)}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={reset} disabled={busy}>{t("actions.dismiss")}</Button>
            <Button onClick={submit} disabled={busy}>{t("actions.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === "close" || action === "cancel"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "close" ? t("actions.closeTitle") : t("actions.cancelTitle")}</DialogTitle>
            <DialogDescription>
              {error ?? (action === "close" ? t("actions.closeDescription") : t("actions.cancelDescription"))}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("actions.reason")}
            aria-label={t("actions.reason")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={reset} disabled={busy}>{t("actions.dismiss")}</Button>
            <Button onClick={submit} disabled={busy || (action === "close" && !reason.trim())}>
              {action === "close" ? t("actions.close") : t("actions.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
