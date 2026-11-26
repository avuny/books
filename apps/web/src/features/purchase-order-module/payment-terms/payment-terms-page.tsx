import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  PAYMENT_TERM_DAYS_MAX,
  PAYMENT_TERM_METHODS,
  PAYMENT_TERM_METHODS_WITHOUT_DAYS,
  type PaymentTermMethod,
} from "@avuny/contracts"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import {
  usePaymentTermMutations,
  usePaymentTermsAdmin,
  usePurchaseOrderAbilities,
  type PaymentTermRow,
} from "../purchase-order-api"

type Props = { orgId: string; onBack: () => void }
type Draft = { id: string | null; name: string; method: PaymentTermMethod; days: string }

const EMPTY: Draft = { id: null, name: "", method: "NET_DAYS", days: "30" }

export function PaymentTermsPage({ orgId, onBack }: Props) {
  const { t } = useTranslation("purchase-order")
  const abilities = usePurchaseOrderAbilities(orgId)
  const { terms } = usePaymentTermsAdmin(orgId)
  const { create, update } = usePaymentTermMutations(orgId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  const needsDays = (m: PaymentTermMethod) => !PAYMENT_TERM_METHODS_WITHOUT_DAYS.includes(m)

  const save = async () => {
    if (!draft) return
    setError(null)
    const days = needsDays(draft.method) ? Number(draft.days) : 0
    if (!draft.name.trim() || !Number.isInteger(days) || days < 0 || days > PAYMENT_TERM_DAYS_MAX) {
      return setError(t("paymentTerms.invalid"))
    }
    const data = { name: draft.name.trim(), method: draft.method, days }
    try {
      if (draft.id) await update.mutateAsync({ orgId, id: draft.id, data })
      else await create.mutateAsync({ orgId, data })
      setDraft(null)
    } catch (e) {
      setError(parseApiError(e).message || null)
    }
  }

  const toggle = async (term: PaymentTermRow) => {
    setError(null)
    try {
      await update.mutateAsync({ orgId, id: term.id, data: { isActive: !term.isActive } })
    } catch (e) {
      setError(parseApiError(e).message || null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("paymentTerms.back")}
      </Button>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("paymentTerms.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("paymentTerms.description")}</p>
        </div>
        {abilities.canManagePaymentTerms ? (
          <Button onClick={() => setDraft(EMPTY)}>{t("paymentTerms.new")}</Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {draft ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <Input
            className="w-56"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={t("paymentTerms.name")}
            aria-label={t("paymentTerms.name")}
          />
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={draft.method}
            onChange={(e) => setDraft({ ...draft, method: e.target.value as PaymentTermMethod })}
            aria-label={t("paymentTerms.method")}
          >
            {PAYMENT_TERM_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`paymentTerms.methods.${m}`)}
              </option>
            ))}
          </select>
          {needsDays(draft.method) ? (
            <Input
              className="w-24"
              value={draft.days}
              onChange={(e) => setDraft({ ...draft, days: e.target.value })}
              placeholder={t("paymentTerms.days")}
              aria-label={t("paymentTerms.days")}
            />
          ) : null}
          <Button onClick={save} disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? t("paymentTerms.saving") : t("paymentTerms.save")}
          </Button>
          <Button variant="outline" onClick={() => setDraft(null)}>
            {t("shipments.cancel")}
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {[t("paymentTerms.name"), t("paymentTerms.method"), t("paymentTerms.days"), "", ""].map((h, i) => (
                <th key={i} className="px-3 py-2 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <tr key={term.id} className="border-t">
                <td className="px-3 py-2">{term.name}</td>
                <td className="px-3 py-2">{t(`paymentTerms.methods.${term.method}`)}</td>
                <td className="px-3 py-2 tabular-nums">{term.days}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {term.isSystem ? t("paymentTerms.system") : term.isActive ? t("paymentTerms.active") : t("paymentTerms.inactive")}
                </td>
                <td className="flex gap-2 px-3 py-2">
                  {!term.isSystem && abilities.canManagePaymentTerms ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft({ id: term.id, name: term.name, method: term.method, days: String(term.days) })
                        }
                      >
                        {t("paymentTerms.edit")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggle(term)}>
                        {term.isActive ? t("paymentTerms.deactivate") : t("paymentTerms.activate")}
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
