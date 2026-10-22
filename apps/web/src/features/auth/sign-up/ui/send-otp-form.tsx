import type { FormEventHandler } from "react"
import type { UseFormReturn } from "react-hook-form"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { SignUpCopy } from "../types"

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
        <InputField
          control={form.control}
          name="identifier"
          copy={copy.field}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoFocus
          disabled={isSubmitting}
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
