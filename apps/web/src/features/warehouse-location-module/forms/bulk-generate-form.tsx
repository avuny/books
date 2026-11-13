import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { BulkCreateWarehouseLocationsSchema, countBulkNodes, validateBulkLevels, type BulkLevel } from "@avuny/contracts"

import {
  AsyncComboboxField,
  FormShell,
  SelectField,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import { isDefaultCodePrefix, suggestBulkLevelType, suggestedCodePrefix } from "../lib"
import type { BulkCreateWarehouseLocationsInput, BulkCreateWarehouseLocationsResult, WarehouseLocationType, WarehouseType } from "../types"
import type { LocationBulkFormCopy } from "./location-form-types"

import type { z } from "@avuny/zod"

export type BulkGenerateFormValues = BulkCreateWarehouseLocationsInput
type BulkGenerateFormInput = z.input<typeof BulkCreateWarehouseLocationsSchema>

type BulkGenerateFormProps = {
  copy: LocationBulkFormCopy
  comboboxCopy: AsyncComboboxCopy
  parentSource: AsyncOptionsSource
  /** Given: the branch is generated inside it and the parent cannot be changed. */
  fixedParent: { id: string; name: string; type: WarehouseLocationType } | null
  warehouseType: WarehouseType
  /** Types allowed here, already translated. */
  typeOptions: { value: string; label: string }[]
  /** Result of the last dry run; null until the user previews. */
  preview: BulkCreateWarehouseLocationsResult | null
  isPreviewing: boolean
  onPreview: (values: BulkGenerateFormValues) => void
  onSubmit: (values: BulkGenerateFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

const baseResolver = zodResolver(BulkCreateWarehouseLocationsSchema)

function newLevel(previous: WarehouseLocationType | null, warehouseType: WarehouseType) {
  const type = suggestBulkLevelType(previous, warehouseType)
  return { type, prefix: suggestedCodePrefix(type), start: 1, count: 1, pad: 2 }
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function BulkGenerateForm({
  copy,
  comboboxCopy,
  parentSource,
  fixedParent,
  warehouseType,
  typeOptions,
  preview,
  isPreviewing,
  onPreview,
  onSubmit,
  isPending,
  errorMessage,
}: BulkGenerateFormProps) {
  const form = useForm<BulkGenerateFormInput, unknown, BulkGenerateFormValues>({
    resolver: (values, context, options) => baseResolver(mapBlanks(values, ["parentId"], undefined), context, options),
    defaultValues: {
      parentId: fixedParent?.id ?? "",
      levels: [newLevel(fixedParent?.type ?? null, warehouseType)],
      dryRun: false,
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "levels" })
  const levels = useWatch({ control: form.control, name: "levels" })

  // Changing a level's type proposes that type's usual prefix, unless the user already typed their own.
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      const match = name ? /^levels\.(\d+)\.type$/.exec(name) : null
      if (!match) return
      const index = Number(match[1])
      const level = value.levels?.[index]
      if (level?.type && isDefaultCodePrefix(level.prefix ?? "")) {
        form.setValue(`levels.${index}.prefix`, suggestedCodePrefix(level.type))
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  // Live estimate so mistakes show before a request is sent (the server has the final say).
  const parsed: BulkLevel[] = (levels ?? []).map((l) => ({
    type: l.type,
    prefix: l.prefix ?? "",
    start: Number(l.start) || 0,
    count: Number(l.count) || 0,
    pad: Number(l.pad) || 0,
  }))
  const total = countBulkNodes(parsed)
  const tooMany = !Number.isFinite(total)
  const orderOk = validateBulkLevels(fixedParent?.type ?? null, parsed)
  const canRun = !tooMany && orderOk && total > 0

  const errors = form.formState.errors.levels

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => {
          if (canRun) onSubmit({ ...values, dryRun: false })
        })} noValidate className="space-y-6">
        {fixedParent ? (
          <p className="text-sm text-muted-foreground">
            {copy.parent.fixed} <span className="font-medium text-foreground">{fixedParent.name}</span>
          </p>
        ) : (
          <AsyncComboboxField
            control={form.control}
            name="parentId"
            copy={copy.parent}
            comboboxCopy={comboboxCopy}
            source={parentSource}
            disabled={isPending}
            placeholder={copy.parent.placeholder}
          />
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <fieldset key={field.id} className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-medium text-foreground">{copy.level(index + 1)}</legend>
              <SelectField
                control={form.control}
                name={`levels.${index}.type`}
                copy={{ label: copy.levelFields.type, placeholder: "" }}
                options={typeOptions}
                disabled={isPending}
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["prefix", copy.levelFields.prefix, "text"],
                    ["start", copy.levelFields.start, "number"],
                    ["count", copy.levelFields.count, "number"],
                    ["pad", copy.levelFields.pad, "number"],
                  ] as const
                ).map(([key, label, inputType]) => (
                  <div key={key} className="grid gap-1.5">
                    <Label htmlFor={`${field.id}-${key}`}>{label}</Label>
                    <Input
                      id={`${field.id}-${key}`}
                      type={inputType}
                      inputMode={inputType === "number" ? "numeric" : undefined}
                      autoComplete="off"
                      disabled={isPending}
                      {...form.register(`levels.${index}.${key}`, inputType === "number" ? { valueAsNumber: true } : undefined)}
                    />
                    {errors?.[index]?.[key]?.message ? (
                      <p role="alert" className="text-xs text-destructive">
                        {errors[index]?.[key]?.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {fields.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => remove(index)}>
                  {copy.levelFields.remove}
                </Button>
              ) : null}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || fields.length >= 7}
            onClick={() => append(newLevel(parsed.at(-1)?.type ?? fixedParent?.type ?? null, warehouseType))}
          >
            {copy.levelFields.add}
          </Button>
        </div>

        <div className="space-y-1 text-sm" aria-live="polite">
          {tooMany ? (
            <p role="alert" className="text-destructive">{copy.tooMany}</p>
          ) : (
            <p className="text-foreground">{copy.total(total)}</p>
          )}
          {!orderOk ? <p role="alert" className="text-destructive">{copy.badOrder}</p> : null}
        </div>

        {preview ? (
          <div className="space-y-1 rounded-lg border border-dashed border-border p-3 text-sm">
            <p className="font-medium text-foreground">{copy.total(preview.total)}</p>
            <p className="text-xs text-muted-foreground">{copy.examples}</p>
            <p className="break-words font-mono text-xs text-muted-foreground">{preview.sampleFullCodes.join(" · ")}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            disabled={isPending || isPreviewing || !canRun}
            onClick={() => void form.handleSubmit((values) => onPreview({ ...values, dryRun: true }))()}
          >
            {isPreviewing ? copy.previewing : copy.preview}
          </Button>
          <SubmitButton className="sm:flex-1" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
        </div>
      </form>
    </FormShell>
  )
}
