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
import { FormShell } from "./form-shell"
import { SubmitButton } from "./submit-button"

type Values = {
  name: string
  password: string
  confirmPassword: string
}

type Props = {
  form: UseFormReturn<Values>
  onSubmit: FormEventHandler<HTMLFormElement>
  isSubmitting: boolean
  errorMessage: string | null
  copy: SignUpCopy["register"]
}

export function CompleteRegistrationForm({
  form,
  onSubmit,
  isSubmitting,
  errorMessage,
  copy,
}: Props) {
  const fields = [
    {
      name: "name",
      copy: copy.name,
      type: "text",
      autoComplete: "name",
    },
    {
      name: "password",
      copy: copy.password,
      type: "password",
      autoComplete: "new-password",
    },
    {
      name: "confirmPassword",
      copy: copy.confirmPassword,
      type: "password",
      autoComplete: "new-password",
    },
  ] as const

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {fields.map((f, i) => (
          <Controller
            key={f.name}
            control={form.control}
            name={f.name}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{f.copy.label}</FieldLabel>

                <Input
                  {...field}
                  id={field.name}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  autoFocus={i === 0}
                  placeholder={f.copy.placeholder}
                  disabled={isSubmitting}
                  aria-invalid={fieldState.invalid}
                />

                {f.copy.description && (
                  <FieldDescription>{f.copy.description}</FieldDescription>
                )}

                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        ))}

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
