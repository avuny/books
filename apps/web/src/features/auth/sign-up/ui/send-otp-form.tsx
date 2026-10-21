import type { FormEventHandler } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import type { SignUpCopy } from "../types"
import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"

type Props = {
  form: UseFormReturn<{ identifier: string }>
  onSubmit: FormEventHandler<HTMLFormElement>
  isSubmitting: boolean
  errorMessage: string | null
  copy: SignUpCopy["identifier"]
}

export function SendOtpForm({
  form,
  onSubmit,
  isSubmitting,
  errorMessage,
  copy,
}: Props) {
  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <Controller
          control={form.control}
          name="identifier"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{copy.field.label}</FieldLabel>

              <Input
                {...field}
                id={field.name}
                type="text"
                inputMode="email"
                autoComplete="username"
                autoFocus
                placeholder={copy.field.placeholder}
                disabled={isSubmitting}
                aria-invalid={fieldState.invalid}
              />

              {copy.field.description && (
                <FieldDescription>{copy.field.description}</FieldDescription>
              )}

              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <SubmitButton
          className="w-full"
          loading={isSubmitting}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>
    </FormShell>
  )
}
