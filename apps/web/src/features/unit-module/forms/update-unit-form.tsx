import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"

import {
  FormShell,
  InputField,
  SubmitButton,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import type { UnitDto } from "../types"
import { updateUnitFormSchema } from "./unit-form-schema"
import type { UnitFormCopy, UpdateUnitFormValues } from "./unit-form-types"

type UpdateUnitFormProps = {
  unit: UnitDto
  copy: UnitFormCopy
  onSubmit: (values: UpdateUnitFormValues) => void
  onCancel?: () => void
  isPending: boolean
  errorMessage?: string | null
}

export function UpdateUnitForm({
  unit,
  copy,
  onSubmit,
  onCancel,
  isPending,
  errorMessage,
}: UpdateUnitFormProps) {
  const form = useForm<UpdateUnitFormValues>({
    resolver: zodResolver(updateUnitFormSchema) as Resolver<UpdateUnitFormValues>,
    defaultValues: {
      name: unit.name,
      symbol: unit.symbol,
      isActive: unit.isActive,
    },
  })

  return (
    <FormShell
      title={copy.update.title}
      description={copy.update.description}
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
        />

        <InputField
          control={form.control}
          name="symbol"
          copy={copy.fields.symbol}
          disabled={isPending}
        />

        {/* Read-only measurement type */}
        <Field>
          <FieldLabel>{copy.fields.type.label}</FieldLabel>
          <Input
            value={copy.types[unit.type]}
            disabled
            readOnly
            className="cursor-not-allowed bg-muted"
          />
          <FieldDescription>{copy.fields.type.locked}</FieldDescription>
        </Field>

        {/* Active checkbox */}
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Field className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
              />
              <div className="space-y-1 leading-none">
                <FieldLabel>{copy.fields.isActive.label}</FieldLabel>
                <FieldDescription>
                  {copy.fields.isActive.description}
                </FieldDescription>
              </div>
            </Field>
          )}
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
            label={copy.update.submitLabel}
            loadingLabel={copy.update.submittingLabel}
          />
        </div>
      </form>
    </FormShell>
  )
}
