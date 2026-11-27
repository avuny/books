import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"

export function TransferStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("inventory-transfer")
  const variant =
    status === "RECEIVED" ? "default" : status === "DRAFT" ? "secondary" : status === "CANCELLED" ? "destructive" : "outline"
  return <Badge variant={variant}>{t(`labels.status.${status}`, { defaultValue: status })}</Badge>
}
