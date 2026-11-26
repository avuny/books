import { useTranslation } from "react-i18next"

import { usePurchaseOrder } from "../purchase-order-api"
import { CreatePurchaseOrder } from "./create-purchase-order"

type Props = { orgId: string; orderId: string; onDone: () => void; onCancel: () => void }

export function EditPurchaseOrder({ orgId, orderId, onDone, onCancel }: Props) {
  const { t } = useTranslation("purchase-order")
  const { order, isLoading } = usePurchaseOrder(orgId, orderId)

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>
  if (!order) return <div className="p-6 text-sm text-muted-foreground">{t("details.notFound")}</div>
  if (order.status !== "DRAFT") {
    return <div className="p-6 text-sm text-muted-foreground">{t("errors.PURCHASE_ORDER_NOT_EDITABLE")}</div>
  }
  return <CreatePurchaseOrder key={order.id} orgId={orgId} order={order} onCreated={() => onDone()} onCancel={onCancel} />
}
