import { useEffect } from "react"
import { useFieldArray, useWatch, type Control } from "react-hook-form"

import { InputField } from "@workspace/ui/blocks/form"

import type { CreateItemFormInput } from "./item-form-schema"
import type { CollectionUnitOption, ItemFormCopy } from "./item-form-types"

type UnitPricesFieldsProps = {
  control: Control<CreateItemFormInput, any, any>
  copy: ItemFormCopy["unitPrices"]
  /** Units of the item's collection, base unit first. Empty until a collection is known. */
  units: CollectionUnitOption[]
  disabled: boolean
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`)

const unitLabel = (unit: CollectionUnitOption) =>
  unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name

/**
 * Optional cost and selling price for every unit of the item's collection. The base unit uses the
 * item's own costPrice / sellingPrice fields; every other unit is one row of `unitPrices`
 * (prices per 1 of that unit). Rows follow the collection: switching collection drops rows of
 * units that are gone and keeps what was typed for the units that remain. Pure: no i18n, no API.
 */
export function UnitPricesFields({
  control,
  copy,
  units,
  disabled,
}: UnitPricesFieldsProps) {
  const base = units.find((u) => u.isBase)
  const others = units.filter((u) => !u.isBase)
  const { fields, replace } = useFieldArray({ control, name: "unitPrices" })
  const current = useWatch({ control, name: "unitPrices" })

  const wanted = others.map((u) => u.id).join(",")
  useEffect(() => {
    // Wait for the collection: an empty list while it loads must not wipe saved prices.
    if (units.length === 0) return
    const have = (current ?? []).map((r) => r.unitId).join(",")
    if (have === wanted) return
    replace(
      others.map(
        (u) =>
          (current ?? []).find((r) => r.unitId === u.id) ?? {
            unitId: u.id,
            costPrice: "",
            sellingPrice: "",
          }
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, units.length])

  const byId = new Map(units.map((u) => [u.id, u]))

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {copy.sectionTitle}
        </h3>
        <p className="text-xs text-muted-foreground">
          {copy.sectionDescription}
        </p>
      </div>

      <PriceRow
        title={
          base
            ? fill(copy.baseUnitTitle, { unit: unitLabel(base) })
            : copy.sectionTitle
        }
      >
        <InputField
          control={control}
          name="costPrice"
          copy={copy.costPrice}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
        />
        <InputField
          control={control}
          name="sellingPrice"
          copy={copy.sellingPrice}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
        />
      </PriceRow>

      {fields.map((field, index) => {
        const unit = byId.get(field.unitId)
        if (!unit) return null
        return (
          <PriceRow
            key={field.id}
            title={fill(copy.unitTitle, { unit: unitLabel(unit) })}
            hint={`1 ${unit.symbol || unit.name} = ${unit.factor} ${base?.symbol || base?.name || ""}`.trim()}
          >
            <InputField
              control={control}
              name={`unitPrices.${index}.costPrice`}
              copy={copy.costPrice}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={disabled}
            />
            <InputField
              control={control}
              name={`unitPrices.${index}.sellingPrice`}
              copy={copy.sellingPrice}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={disabled}
            />
          </PriceRow>
        )
      })}

      {units.length > 0 && others.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {copy.noOtherUnits}
        </p>
      ) : null}
    </div>
  )
}

function PriceRow({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3 shadow-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}
