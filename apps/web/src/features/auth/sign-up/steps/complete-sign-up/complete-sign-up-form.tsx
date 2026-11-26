import { useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "@avuny/zod"
import { SignUpBodySchema, validatePasswordBytes } from "@avuny/contracts/user"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

function createSchema(passwordMismatchMessage: string) {
  return SignUpBodySchema.pick({ name: true, password: true })
    .extend({ confirmPassword: z.string() })
    .superRefine((v, ctx) => {
      const bytesError = validatePasswordBytes(v.password)
      if (bytesError) {
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: bytesError,
        })
      }
      if (v.password !== v.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: passwordMismatchMessage,
        })
      }
    })
}

export type CompleteSignUpFormValues = z.infer<ReturnType<typeof createSchema>>

/** Localized strings for this form. Built and injected by the container. */
export type CompleteSignUpCopy = {
  title: string
  description: string
  name: FieldCopy
  password: FieldCopy
  confirmPassword: FieldCopy
  passwordMismatchMessage: string
  submitLabel: string
  submittingLabel: string
}

type CompleteSignUpFormProps = {
  copy: CompleteSignUpCopy
  onSubmit: (values: CompleteSignUpFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
  /** Already localized. Server-side password rejection, shown under the field. */
  passwordError?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CompleteSignUpForm({
  copy,
  onSubmit,
  isPending,
  errorMessage,
  passwordError,
}: CompleteSignUpFormProps) {
  const schema = useMemo(
    () => createSchema(copy.passwordMismatchMessage),
    [copy.passwordMismatchMessage]
  )

  const form = useForm<CompleteSignUpFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  })

  const { setError } = form
  useEffect(() => {
    if (passwordError) setError("password", { message: passwordError })
  }, [passwordError, setError])

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
