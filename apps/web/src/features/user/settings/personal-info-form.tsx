import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "@avuny/zod"
import { UpdateProfileBodySchema } from "@avuny/contracts/user"
import { CheckCircle2Icon } from "lucide-react"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type PersonalInfoFormValues = z.infer<typeof UpdateProfileBodySchema>

/** Localized strings for this form. Built and injected by the container. */
export type PersonalInfoCopy = {
  title: string
  description: string
  name: FieldCopy
  identifier?: {
    label: string
  }
  submitLabel: string
  submittingLabel: string
  successMessage?: string
}

export type PersonalInfoFormProps = {
  copy: PersonalInfoCopy
  onSubmit: (values: PersonalInfoFormValues) => void
  isPending: boolean
  defaultName?: string
  identifier?: string
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
  /** Already localized. Shown in the form-level success alert. */
  successMessage?: string | null
}

// Pure presentation & validation. No i18n, API, auth or navigation knowledge.
export function PersonalInfoForm({
  copy,
  onSubmit,
  isPending,
  defaultName = "",
  identifier,
  errorMessage,
  successMessage,
}: PersonalInfoFormProps) {
  const form = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(UpdateProfileBodySchema),
    values: { name: defaultName },
  })

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        {identifier && copy.identifier && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {copy.identifier.label}
            </label>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground shadow-xs">
              {identifier}
            </div>
          </div>
        )}

        <InputField
          control={form.control}
          name="name"
          copy={copy.name}
          type="text"
          autoComplete="name"
          autoFocus
          disabled={isPending}
        />

        <div className="flex justify-start">
          <SubmitButton
            loading={isPending}
            label={copy.submitLabel}
            loadingLabel={copy.submittingLabel}
          />
        </div>
      </form>
    </FormShell>
  )
}
