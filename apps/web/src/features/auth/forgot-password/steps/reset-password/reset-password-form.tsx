import { useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "@avuny/zod"
import { ForgotPasswordResetBodySchema } from "@avuny/contracts"
import { validatePasswordBytes } from "@avuny/contracts/user"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

function createSchema(passwordMismatchMessage: string) {
  return ForgotPasswordResetBodySchema.pick({ newPassword: true })
    .extend({ confirmPassword: z.string() })
    .superRefine((v, ctx) => {
      const bytesError = validatePasswordBytes(v.newPassword)
      if (bytesError) {
        ctx.addIssue({
          code: "custom",
          path: ["newPassword"],
          message: bytesError,
        })
      }
      if (v.newPassword !== v.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: passwordMismatchMessage,
        })
      }
    })
}

export type ResetPasswordFormValues = z.infer<ReturnType<typeof createSchema>>

/** Localized strings for this form. Built and injected by the container. */
export type ResetPasswordCopy = {
  title: string
  description: string
  newPassword: FieldCopy
  confirmPassword: FieldCopy
  passwordMismatchMessage: string
  submitLabel: string
  submittingLabel: string
}

type ResetPasswordFormProps = {
  copy: ResetPasswordCopy
  onSubmit: (values: ResetPasswordFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
  /** Already localized. Server-side password rejection, shown under the field. */
  passwordError?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function ResetPasswordForm({
  copy,
  onSubmit,
  isPending,
  errorMessage,
  passwordError,
}: ResetPasswordFormProps) {
  const schema = useMemo(
    () => createSchema(copy.passwordMismatchMessage),
    [copy.passwordMismatchMessage]
  )

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  const { setError } = form
  useEffect(() => {
    if (passwordError) setError("newPassword", { message: passwordError })
  }, [passwordError, setError])

  const fields = [
    {
      name: "newPassword",
      copy: copy.newPassword,
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
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        {fields.map((f, i) => (
          <InputField
            key={f.name}
            control={form.control}
            name={f.name}
            copy={f.copy}
            type={f.type}
            autoComplete={f.autoComplete}
            autoFocus={i === 0}
            disabled={isPending}
          />
        ))}

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
