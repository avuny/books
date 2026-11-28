import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Trash2 } from "lucide-react"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import {
  fetchItemOptions,
  fetchItemUnits,
  useCreateTransferMutation,
  useLocationOptions,
  useWarehouseOptions,
  type Option,
} from "./inventory-transfer-api"

type Line = { itemId: string; unitId: string; sourceLocationId: string; destinationLocationId: string; quantity: string }
const blank = (): Line => ({ itemId: "", unitId: "", sourceLocationId: "", destinationLocationId: "", quantity: "" })
const today = () => new Date().toISOString().slice(0, 10)

function Select({
  value,
  onChange,
  options,
  placeholder,
  label,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder: string
  label: string
  disabled?: boolean
}) {
  return (
    <NativeSelect className="w-full" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {options.map((o) => (
        <NativeSelectOption key={o.value} value={o.value}>
          {o.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function CreateTransferDialog({
  orgId,
  open,
  onOpenChange,
  onCreated,
}: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}) {
  const { t } = useTranslation("inventory-transfer")
  const [date, setDate] = useState(today())
  const [reference, setReference] = useState("")
  const [description, setDescription] = useState("")
  const [sourceWh, setSourceWh] = useState("")
  const [destWh, setDestWh] = useState("")
  const [lines, setLines] = useState<Line[]>([blank()])
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Option[]>([])
  const [units, setUnits] = useState<Record<string, Option[]>>({})

  const warehouses = useWarehouseOptions(orgId)
  const srcLocs = useLocationOptions(orgId, sourceWh)
  const dstLocs = useLocationOptions(orgId, destWh)
  const create = useCreateTransferMutation(orgId)

  useEffect(() => {
    if (open) void fetchItemOptions(orgId, "").then(setItems)
  }, [open, orgId])

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const pickItem = async (i: number, itemId: string) => {
    setLine(i, { itemId, unitId: "" })
    if (!itemId) return
    const opts = units[itemId] ?? (await fetchItemUnits(orgId, itemId))
    setUnits((u) => ({ ...u, [itemId]: opts }))
    setLine(i, { itemId, unitId: opts[0]?.value ?? "" })
  }

  const submit = async () => {
    setError(null)
    if (!sourceWh || !destWh) return setError(t("ui.validation.warehouses"))
    const filled = lines.filter((l) => l.itemId)
    if (filled.length === 0) return setError(t("ui.validation.noLines"))
    for (const l of filled) {
      if (!l.sourceLocationId || !l.destinationLocationId) return setError(t("ui.validation.locations"))
      if (!/^\d+(\.\d{1,6})?$/.test(l.quantity) || Number(l.quantity) <= 0) return setError(t("ui.validation.quantity"))
    }
    try {
      const res = await create.mutateAsync({
        orgId,
        data: {
          date,
          referenceNumber: reference.trim() || undefined,
          description: description.trim() || undefined,
          sourceWarehouseId: sourceWh,
          destinationWarehouseId: destWh,
          lines: filled.map((l) => ({
            itemId: l.itemId,
            unitId: l.unitId,
            sourceLocationId: l.sourceLocationId,
            destinationLocationId: l.destinationLocationId,
            quantity: l.quantity,
          })),
        } as any,
      })
      onOpenChange(false)
      setLines([blank()])
      setReference("")
      setDescription("")
      onCreated?.((res.data as any).id)
    } catch (e) {
      setError(parseApiError(e).message || "Error")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("ui.new")}</DialogTitle>
          <DialogDescription>{t("ui.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t("ui.fields.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ui.fields.reference")}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ui.fields.source")}</Label>
            <Select
              label={t("ui.fields.source")}
              value={sourceWh}
              onChange={(v) => {
                setSourceWh(v)
                setLines((ls) => ls.map((l) => ({ ...l, sourceLocationId: "" })))
              }}
              options={warehouses.options}
              placeholder={t("ui.fields.select")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("ui.fields.destination")}</Label>
            <Select
              label={t("ui.fields.destination")}
              value={destWh}
              onChange={(v) => {
                setDestWh(v)
                setLines((ls) => ls.map((l) => ({ ...l, destinationLocationId: "" })))
              }}
              options={warehouses.options}
              placeholder={t("ui.fields.select")}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("ui.fields.description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <Select
                  label={t("ui.fields.item")}
                  value={l.itemId}
                  onChange={(v) => void pickItem(i, v)}
                  options={items}
                  placeholder={t("ui.fields.item")}
                />
              </div>
              <Select
                label={t("ui.fields.sourceLocation")}
                value={l.sourceLocationId}
                onChange={(v) => setLine(i, { sourceLocationId: v })}
                options={srcLocs.options}
                placeholder={t("ui.fields.sourceLocation")}
                disabled={!sourceWh}
              />
              <Select
                label={t("ui.fields.destinationLocation")}
                value={l.destinationLocationId}
                onChange={(v) => setLine(i, { destinationLocationId: v })}
                options={dstLocs.options}
                placeholder={t("ui.fields.destinationLocation")}
                disabled={!destWh}
              />
              <Select
                label={t("ui.fields.unit")}
                value={l.unitId}
                onChange={(v) => setLine(i, { unitId: v })}
                options={units[l.itemId] ?? []}
                placeholder={t("ui.fields.unit")}
                disabled={!l.itemId}
              />
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  aria-label={t("ui.fields.quantity")}
                  placeholder={t("ui.fields.quantity")}
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("ui.actions.removeLine")}
                  disabled={lines.length === 1}
                  onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setLines((ls) => [...ls, blank()])}>
            <Plus className="me-2 size-4" />
            {t("ui.actions.addLine")}
          </Button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {t("ui.actions.close")}
          </Button>
          <Button onClick={() => void submit()} disabled={create.isPending}>
            {t("ui.actions.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
