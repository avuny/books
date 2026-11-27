import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import {
  FormShell,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { MultiStepFlow } from "@workspace/ui/blocks/multi-step"
import { Button } from "@workspace/ui/components/button"

import { ItemFields } from "./item-fields"
import {
  CreateItemFormSchema,
  getCreateItemDefaults,
  type CreateItemFormInput,
  type CreateItemFormValues,
} from "./item-form-schema"
import type {
  CollectionUnitOption,
  ItemFormCopy,
  ItemPickers,
  ShelfLifeUnitOption,
  ValuationOption,
} from "./item-form-types"
import { OpeningStockFields } from "./opening-stock-fields"
import { UnitPricesFields } from "./unit-prices-fields"

export type { CreateItemFormValues }

/** Create flow: 1. details, 2. optional prices per unit, 3. optional opening stock (stocked items only). */
export type CreateItemStep = "details" | "prices" | "stock"
const ALL_STEPS: readonly CreateItemStep[] = ["details", "prices", "stock"]

/** Fields each step owns; "Next" validates only these. */
const STEP_FIELDS: Record<CreateItemStep, (keyof CreateItemFormInput)[]> = {
  details: [
    "name",
    "description",
    "categoryId",
    "baseUnitId",
    "unitCollectionId",
    "isInventoryTracked",
    "isBatchTracked",
    "isExpiryTracked",
    "defaultShelfLifeValue",
    "defaultShelfLifeUnit",
    "inventoryValuationMethod",
    "reorderPoint",
  ],
  prices: ["costPrice", "sellingPrice", "unitPrices"],
  stock: ["openingStockLines"],
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`))

type CreateItemFormProps = {
  copy: ItemFormCopy
  pickers: ItemPickers
  valuationOptions: ValuationOption[]
  shelfLifeUnitOptions: ShelfLifeUnitOption[]
  defaultName?: string
  onSubmit: (values: CreateItemFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  /** Units of the picked unit collection (base first). Empty until one is picked and loaded. */
  collectionUnits: CollectionUnitOption[]
  /** Called with the picked collection id (or undefined) so the caller can load its units. */
  onCollectionChange: (collectionId: string | undefined) => void
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateItemForm({
  copy,
  pickers,
  valuationOptions,
  shelfLifeUnitOptions,
  defaultName,
  onSubmit,
  isPending,
  errorMessage,
  locationSource,
  comboboxCopy,
  collectionUnits,
  onCollectionChange,
}: CreateItemFormProps) {
  const form = useForm<CreateItemFormInput, unknown, CreateItemFormValues>({
    resolver: zodResolver(CreateItemFormSchema),
    defaultValues: getCreateItemDefaults(defaultName),
  })
  const [step, setStep] = useState<CreateItemStep>("details")

  const collectionId = useWatch({ control: form.control, name: "unitCollectionId" })
  const isInventoryTracked = useWatch({
    control: form.control,
    name: "isInventoryTracked",
  })
  const isExpiryTracked = useWatch({
    control: form.control,
    name: "isExpiryTracked",
  })

  useEffect(() => {
    onCollectionChange((collectionId as string | undefined) || undefined)
  }, [collectionId, onCollectionChange])

  // Opening stock needs inventory tracking, so an untracked item has two steps.
  const steps = useMemo(
    () => (isInventoryTracked ? ALL_STEPS : ALL_STEPS.slice(0, 2)),
    [isInventoryTracked]
  )
  const index = Math.max(0, steps.indexOf(step))
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  const goNext = async () => {
    const valid = await form.trigger(STEP_FIELDS[step])
    if (valid) setStep(steps[index + 1] ?? step)
  }
  const goBack = () => setStep(steps[index - 1] ?? step)

  const stepDescription = {
    details: copy.steps.descriptionDetails,
    prices: copy.steps.descriptionPrices,
    stock: copy.steps.descriptionStock,
  }[step]

  const control = form.control

  return (
    <FormShell
      title={copy.title}
      description={stepDescription}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={(event) => {
          // Enter inside a field must not create the item before the last step.
          if (!isLast) {
            event.preventDefault()
            void goNext()
            return
          }
          void form.handleSubmit((values) => onSubmit(values))(event)
        }}
        noValidate
        className="space-y-6"
      >
        <MultiStepFlow
          steps={steps}
          current={step}
          formatLabel={(position) => fill(copy.steps.stepLabel, position)}
          views={{
            details: () => (
              <div className="space-y-6">
                <ItemFields
                  control={control}
                  copy={copy}
                  pickers={pickers}
                  valuationOptions={valuationOptions}
                  shelfLifeUnitOptions={shelfLifeUnitOptions}
                  disabled={isPending}
                  showPrices={false}
                />
              </div>
            ),
            prices: () => (
              <UnitPricesFields
                control={control}
                copy={copy.unitPrices}
                units={collectionUnits}
                disabled={isPending}
              />
            ),
            stock: () => (
              <OpeningStockFields
                control={control}
                copy={copy.openingStock}
                locationSource={locationSource}
                comboboxCopy={comboboxCopy}
                units={collectionUnits}
                isExpiryTracked={Boolean(isExpiryTracked)}
                disabled={isPending}
              />
            ),
          }}
        />

        <div className="flex gap-2">
          {!isFirst ? (
            <Button
              key="back"
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={goBack}
            >
              {copy.steps.back}
            </Button>
          ) : null}
          {isLast ? (
            <SubmitButton
              key="submit"
              className="flex-1"
              loading={isPending}
              label={copy.submitLabel}
              loadingLabel={copy.submittingLabel}
            />
          ) : (
            <Button
              key="next"
              type="button"
              className="flex-1"
              disabled={isPending}
              onClick={() => void goNext()}
            >
              {copy.steps.next}
            </Button>
          )}
        </div>
      </form>
    </FormShell>
  )
}
