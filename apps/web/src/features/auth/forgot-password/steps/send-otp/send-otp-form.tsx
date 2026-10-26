import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "@avuny/zod"
import { ForgotPasswordSendOtpBodySchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type SendOtpFormValues = z.infer<typeof ForgotPasswordSendOtpBodySchema>

/** Localized strings for this form. Built and injected by the container. */
export type SendOtpCopy = {
  title: string
  description: string
  identifier: FieldCopy
  submitLabel: string
  submittingLabel: string
}

type SendOtpFormProps = {
  copy: SendOtpCopy
  /** Pre-fills the field when the user comes back to this step. */
  defaultIdentifier?: string
  onSubmit: (values: SendOtpFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function SendOtpForm({
  copy,
  defaultIdentifier = "",
  onSubmit,
  isPending,
  errorMessage,
}: SendOtpFormProps) {
  const form = useForm<SendOtpFormValues>({
    resolver: zodResolver(ForgotPasswordSendOtpBodySchema),
    defaultValues: { identifier: defaultIdentifier },
  })

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <InputField
          control={form.control}
          name="identifier"
          copy={copy.identifier}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoFocus
          disabled={isPending}
        />

        <SubmitButton
          className="w-full"
          loading={isPending}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>
    </FormShell>
  )
}
