import type { FormEventHandler } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"

import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"
import type { SignInCopy } from "../types"

type Values = {
  identifier: string
  password: string
}

type Props = {
  form: UseFormReturn<Values>
  onSubmit: FormEventHandler<HTMLFormElement>
  onSignUp: () => void
  isSubmitting: boolean
  errorMessage: string | null
  copy: SignInCopy
}

export function SignInForm({
  form,
  onSubmit,
  onSignUp,
  isSubmitting,
  errorMessage,
  copy,
}: Props) {
  const fields = [
    {
      name: "identifier",
      copy: copy.identifier,
      type: "text",
      autoComplete: "username",
    },
    {
      name: "password",
      copy: copy.password,
      type: "password",
      autoComplete: "current-password",
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

      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
        <span>{copy.signUpPrompt}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={isSubmitting}
          onClick={onSignUp}
        >
          {copy.signUpLabel}
        </Button>
      </div>
    </FormShell>
  )
}
