import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  FormShell,
  InputField,
  SelectField,
  SubmitButton,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import {
  createUnitFormSchema,
  type CreateUnitFormInput,
} from "./unit-form-schema"
import type { CreateUnitFormValues, UnitFormCopy } from "./unit-form-types"

type CreateUnitFormProps = {
  copy: UnitFormCopy
  onSubmit: (values: CreateUnitFormValues) => void
  onCancel?: () => void
  isPending: boolean
  errorMessage?: string | null
}

const UNIT_TYPES = ["count", "weight", "length", "area", "volume"] as const

export function CreateUnitForm({
  copy,
  onSubmit,
  onCancel,
  isPending,
  errorMessage,
}: CreateUnitFormProps) {
  const form = useForm<CreateUnitFormInput, unknown, CreateUnitFormValues>({
    resolver: zodResolver(createUnitFormSchema),
    defaultValues: {
      name: "",
      symbol: "",
      type: "count",
    },
  })

  const typeOptions = UNIT_TYPES.map((type) => ({
    value: type,
    label: copy.types[type],
  }))

  return (
    <FormShell
      title={copy.create.title}
      description={copy.create.description}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-4"
      >
        <InputField
          control={form.control}
          name="name"
          copy={copy.fields.name}
          disabled={isPending}
          autoFocus
        />

        <InputField
          control={form.control}
          name="symbol"
          copy={copy.fields.symbol}
          disabled={isPending}
        />

        <SelectField
          control={form.control}
          name="type"
          copy={copy.fields.type}
          options={typeOptions}
          disabled={isPending}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
            >
              {copy.actions.cancel}
            </Button>
          )}
          <SubmitButton
            loading={isPending}
            label={copy.create.submitLabel}
            loadingLabel={copy.create.submittingLabel}
          />
        </div>
      </form>
    </FormShell>
  )
}
