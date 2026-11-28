import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "@avuny/zod"

import { Button } from "@workspace/ui/components/button"
import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export const totpFormSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
})
export type TotpFormValues = z.infer<typeof totpFormSchema>

/** Localized strings for this form. Built and injected by the container. */
export type TotpFormCopy = {
  title: string
  description: string
  code: FieldCopy
  submitLabel: string
  submittingLabel: string
  backLabel: string
}

type TotpFormProps = {
  copy: TotpFormCopy
  onSubmit: (values: TotpFormValues) => void
  onBack: () => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// Step 2 of admin sign-in: the authenticator code for the pending ticket.
export function TotpForm({
  copy,
  onSubmit,
  onBack,
  isPending,
  errorMessage,
}: TotpFormProps) {
  const form = useForm<TotpFormValues>({
    resolver: zodResolver(totpFormSchema),
    defaultValues: { code: "" },
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

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={isPending}
          onClick={onBack}
        >
          {copy.backLabel}
        </Button>
      </form>
    </FormShell>
  )
}
