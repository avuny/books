import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

import { formatMinorAmount } from "../../purchase-order-module/lib/format-money"
import { useSalesInvoices } from "../sales-invoice-api"
import type { InvoiceScope } from "../types"

type Props = { orgId: string; onViewInvoice: (id: string) => void }

const SCOPES: InvoiceScope[] = ["all", "DRAFT", "POSTED", "REVERSED"]

export function SalesInvoiceList({ orgId, onViewInvoice }: Props) {
  const { t, i18n } = useTranslation("sales-invoice")
  const { invoices, isLoading } = useSalesInvoices(orgId)
  const [scope, setScope] = useState<InvoiceScope>("all")
  const rows = scope === "all" ? invoices : invoices.filter((b) => b.status === scope)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t("ui.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ui.description")}</p>
      </div>
      <div className="flex gap-2" role="tablist">
        {SCOPES.map((s) => (
          <Button key={s} size="sm" variant={scope === s ? "default" : "outline"} onClick={() => setScope(s)}>
            {t(`ui.tabs.${s}`)}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ui.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                {[t("ui.number"), t("ui.customer"), t("ui.order"), t("ui.dueDate"), t("ui.total"), t("ui.outstanding"), t("ui.status"), t("ui.payment")].map((h) => (
                  <th key={h} className="px-3 py-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => onViewInvoice(b.id)}>
                  <td className="px-3 py-2 font-medium">{b.number}</td>
                  <td className="px-3 py-2">{b.customerName ?? ""}</td>
                  <td className="px-3 py-2">{b.salesOrderNumber ?? ""}</td>
                  <td className="px-3 py-2">{b.dueDate}</td>
                  <td className="px-3 py-2">{formatMinorAmount(b.total, b.currency, i18n.language)}</td>
                  <td className="px-3 py-2">{b.status === "POSTED" ? formatMinorAmount(b.outstandingAmount, b.currency, i18n.language) : ""}</td>
                  <td className="px-3 py-2">{t(`labels.status.${b.status}`)}</td>
                  <td className="px-3 py-2">{b.paymentStatus ? t(`labels.paymentStatus.${b.paymentStatus}`) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
