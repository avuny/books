import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { AR_AGING_BUCKETS } from "@avuny/contracts"

import { formatMinorAmount } from "../../purchase-order-module/lib/format-money"
import { useArAging, useArReconciliation, useCustomerStatement } from "../sales-invoice-api"

type Props = { orgId: string }
type StatementTarget = { partyId: string; name: string }

export function ArReports({ orgId }: Props) {
  const { t, i18n } = useTranslation("sales-invoice")
  const { aging, isLoading } = useArAging(orgId)
  const { reconciliation } = useArReconciliation(orgId)
  const [target, setTarget] = useState<StatementTarget | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const { statement } = useCustomerStatement(orgId, target ? { partyId: target.partyId, from, to } : null)
  const cur = aging?.rows[0]?.currency ?? statement?.currency ?? "EGP"
  const money = (v: string, c = cur) => formatMinorAmount(v, c, i18n.language)

  const recRows = reconciliation
    ? [
        { key: "ar", label: t("ui.reports.ar"), r: reconciliation.accountsReceivable },
      ]
    : []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t("ui.reports.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ui.reports.description")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("ui.reports.aging")}</h2>
        <p className="text-xs text-muted-foreground">{t("ui.reports.agingNote")}</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : !aging || aging.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ui.reports.agingNone")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t("ui.reports.customer")}</th>
                  {AR_AGING_BUCKETS.map((b) => (
                    <th key={b} className="px-3 py-2 text-start font-medium">{t(`ui.reports.buckets.${b}`)}</th>
                  ))}
                  <th className="px-3 py-2 text-start font-medium">{t("ui.reports.total")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {aging.rows.map((r) => (
                  <tr key={`${r.partyId}-${r.currency}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.partyName ?? r.partyId}</td>
                    {AR_AGING_BUCKETS.map((b) => (
                      <td key={b} className="px-3 py-2">{money(r.buckets[b], r.currency)}</td>
                    ))}
                    <td className="px-3 py-2 font-medium">{money(r.total, r.currency)}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => setTarget({ partyId: r.partyId, name: r.partyName ?? r.partyId })}>
                        {t("ui.reports.statement")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("ui.reports.reconciliation")}</h2>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2" />
                {[t("ui.reports.ledger"), t("ui.reports.subledger"), t("ui.reports.difference"), ""].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recRows.map(({ key, label, r }) => (
                <tr key={key} className="border-t">
                  <td className="px-3 py-2 font-medium">{label}</td>
                  <td className="px-3 py-2">{money(r.ledger)}</td>
                  <td className="px-3 py-2">{money(r.subledger)}</td>
                  <td className="px-3 py-2">{money(r.difference)}</td>
                  <td className="px-3 py-2">{r.balanced ? t("ui.reports.ok") : t("ui.reports.off")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("ui.reports.stmt.title", { name: target?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {statement ? `${t("ui.reports.stmt.opening")}: ${money(statement.openingBalance, statement.currency ?? cur)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("ui.reports.stmt.from")} title={t("ui.reports.stmt.from")} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("ui.reports.stmt.to")} title={t("ui.reports.stmt.to")} />
          </div>
          {statement && statement.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("ui.reports.stmt.none")}</p>
          ) : statement ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    {[t("ui.reports.stmt.date"), t("ui.reports.stmt.document"), t("ui.reports.stmt.reference"), t("ui.reports.stmt.charge"), t("ui.reports.stmt.payment"), t("ui.reports.stmt.balance")].map((h) => (
                      <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((l) => (
                    <tr key={`${l.kind}-${l.number}`} className="border-t">
                      <td className="px-3 py-2">{l.date}</td>
                      <td className="px-3 py-2">{l.number}</td>
                      <td className="px-3 py-2">{l.reference ?? ""}</td>
                      <td className="px-3 py-2">{l.charge === "0" ? "" : money(l.charge, statement.currency ?? cur)}</td>
                      <td className="px-3 py-2">{l.payment === "0" ? "" : money(l.payment, statement.currency ?? cur)}</td>
                      <td className="px-3 py-2">{money(l.balance, statement.currency ?? cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {statement ? (
            <p className="text-sm font-medium">
              {t("ui.reports.stmt.closing")}: {money(statement.closingBalance, statement.currency ?? cur)}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
