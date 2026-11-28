import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "@avuny/zod"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export const enrollTotpFormSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
})
export type EnrollTotpFormValues = z.infer<typeof enrollTotpFormSchema>

/** Localized strings for this form. Built and injected by the container. */
export type EnrollTotpFormCopy = {
  title: string
  description: string
  secretLabel: string
  secretHelp: string
  code: FieldCopy
  submitLabel: string
  submittingLabel: string
}

type EnrollTotpFormProps = {
  copy: EnrollTotpFormCopy
  /** The one-time TOTP setup key returned by invite acceptance. Shown once. */
  totpSecret: string
  onSubmit: (values: EnrollTotpFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// Step 2 of joining: enroll the authenticator app (mandatory TOTP, spec 3.2).
export function EnrollTotpForm({
  copy,
  totpSecret,
  onSubmit,
  isPending,
  errorMessage,
}: EnrollTotpFormProps) {
  const form = useForm<EnrollTotpFormValues>({
    resolver: zodResolver(enrollTotpFormSchema),
    defaultValues: { code: "" },
  })

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">{copy.secretLabel}</p>
        <code className="block break-all rounded bg-background px-3 py-2 font-mono text-sm text-foreground">
          {totpSecret}
        </code>
        <p className="text-xs text-muted-foreground">{copy.secretHelp}</p>
      </div>

      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <InputField
          control={form.control}
          name="code"
          copy={copy.code}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
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
