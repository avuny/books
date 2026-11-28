import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "@avuny/zod"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export const acceptInviteFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8),
})
export type AcceptInviteFormValues = z.infer<typeof acceptInviteFormSchema>

/** Localized strings for this form. Built and injected by the container. */
export type AcceptInviteFormCopy = {
  title: string
  description: string
  name: FieldCopy
  password: FieldCopy
  passwordHelp: string
  submitLabel: string
  submittingLabel: string
}

type AcceptInviteFormProps = {
  copy: AcceptInviteFormCopy
  onSubmit: (values: AcceptInviteFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// Step 1 of joining: name and password. UI + validation only.
export function AcceptInviteForm({
  copy,
  onSubmit,
  isPending,
  errorMessage,
}: AcceptInviteFormProps) {
  const form = useForm<AcceptInviteFormValues>({
    resolver: zodResolver(acceptInviteFormSchema),
    defaultValues: { name: "", password: "" },
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
          name="name"
          copy={copy.name}
          type="text"
          autoComplete="name"
          autoFocus
          disabled={isPending}
        />

        <div className="space-y-1">
          <InputField
            control={form.control}
            name="password"
            copy={copy.password}
            type="password"
            autoComplete="new-password"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">{copy.passwordHelp}</p>
        </div>

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
