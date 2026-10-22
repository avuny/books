import type { FormEventHandler } from "react"
import type { UseFormReturn } from "react-hook-form"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { SignUpCopy } from "../types"

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
          <InputField
            key={f.name}
            control={form.control}
            name={f.name}
            copy={f.copy}
            type={f.type}
            autoComplete={f.autoComplete}
            autoFocus={i === 0}
            disabled={isSubmitting}
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
