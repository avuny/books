import { useTranslation } from "react-i18next"

import { useSalesOrder } from "../sales-order-api"
import { CreateSalesOrder } from "./create-sales-order"

type Props = { orgId: string; orderId: string; onDone: () => void; onCancel: () => void }

export function EditSalesOrder({ orgId, orderId, onDone, onCancel }: Props) {
  const { t } = useTranslation("sales-order")
  const { order, isLoading } = useSalesOrder(orgId, orderId)

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">…</div>
  if (!order) return <div className="p-6 text-sm text-muted-foreground">{t("details.notFound")}</div>
  if (order.status !== "DRAFT") {
    return <div className="p-6 text-sm text-muted-foreground">{t("errors.SALES_ORDER_NOT_EDITABLE")}</div>
  }
  return <CreateSalesOrder key={order.id} orgId={orgId} order={order} onCreated={() => onDone()} onCancel={onCancel} />
}
