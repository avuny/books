import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "@avuny/zod"
import { PlatformLoginSchema } from "@avuny/contracts/platform-admin"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type SignInFormValues = z.infer<typeof PlatformLoginSchema>

/** Localized strings for this form. Built and injected by the container. */
export type SignInFormCopy = {
  title: string
  description: string
  email: FieldCopy
  password: FieldCopy
  submitLabel: string
  submittingLabel: string
}

type SignInFormProps = {
  copy: SignInFormCopy
  onSubmit: (values: SignInFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API or navigation knowledge.
export function SignInForm({
  copy,
  onSubmit,
  isPending,
  errorMessage,
}: SignInFormProps) {
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(PlatformLoginSchema),
    defaultValues: { email: "", password: "" },
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
          name="email"
          copy={copy.email}
          type="email"
          autoComplete="username"
          autoFocus
          disabled={isPending}
        />

        <InputField
          control={form.control}
          name="password"
          copy={copy.password}
          type="password"
          autoComplete="current-password"
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
