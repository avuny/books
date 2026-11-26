import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  UpdateOrganizationSchema,
  type UpdateOrganizationInput,
} from "@avuny/contracts/organization"
import { CheckCircle2Icon } from "lucide-react"

import {
  FormShell,
  InputField,
  SelectField,
  SubmitButton,
  type SelectOption,
} from "@workspace/ui/blocks/form"
import { Badge } from "@workspace/ui/components/badge"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type UpdateOrganizationFormValues = UpdateOrganizationInput

export type UpdateOrganizationCopy = {
  title: string
  description: string
  code: {
    label: string
    description?: string
  }
  name: FieldCopy
  countryCode: FieldCopy
  stateId: FieldCopy
  stateDisabledPlaceholder: string
  defaultCurrency: FieldCopy
  timezone: FieldCopy
  status: {
    label: string
  }
  submitLabel: string
  submittingLabel: string
  successMessage?: string
}

type UpdateOrganizationFormProps = {
  copy: UpdateOrganizationCopy
  code: string
  status: string
  countryOptions: SelectOption[]
  stateOptions: SelectOption[]
  currencyOptions: SelectOption[]
  timezoneOptions: SelectOption[]
  selectedCountryCode: string | undefined
  onCountryChange: (countryCode: string) => void
  onSubmit: (values: UpdateOrganizationFormValues) => void
  isPending: boolean
  errorMessage?: string | null
  successMessage?: string | null
  defaultValues: Partial<UpdateOrganizationFormValues>
}

export function UpdateOrganizationForm({
  copy,
  code,
  status,
  countryOptions,
  stateOptions,
  currencyOptions,
  timezoneOptions,
  selectedCountryCode,
  onCountryChange,
  onSubmit,
  isPending,
  errorMessage,
  successMessage,
  defaultValues,
}: UpdateOrganizationFormProps) {
  const form = useForm<UpdateOrganizationFormValues>({
    resolver: zodResolver(UpdateOrganizationSchema),
    values: {
      name: defaultValues.name || "",
      countryCode: defaultValues.countryCode ?? null,
      stateId: defaultValues.stateId ?? null,
      defaultCurrency: defaultValues.defaultCurrency || "USD",
      timezone: defaultValues.timezone || "UTC",
    },
  })

  // Watch countryCode changes to filter states reactively
  const watchedCountry = form.watch("countryCode")
  useEffect(() => {
    if (watchedCountry !== selectedCountryCode) {
      onCountryChange(watchedCountry || "")
      // Only reset stateId if the country genuinely changed from previous value
      if (selectedCountryCode && watchedCountry !== selectedCountryCode) {
        form.setValue("stateId", null)
      }
    }
  }, [watchedCountry, selectedCountryCode, onCountryChange, form])

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Read-only code field */}
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                {copy.code.label}
              </label>
              <Badge
                variant={status === "active" ? "secondary" : "outline"}
                className="text-xs capitalize"
              >
                {status}
              </Badge>
            </div>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-1 font-mono text-sm text-muted-foreground shadow-xs">
              {code}
            </div>
            {copy.code.description && (
              <p className="text-xs text-muted-foreground">
                {copy.code.description}
              </p>
            )}
          </div>

          <InputField
            control={form.control}
            name="name"
            copy={copy.name}
            type="text"
            autoFocus
            disabled={isPending}
            className="sm:col-span-2"
          />

          <SelectField
            control={form.control}
            name="countryCode"
            copy={copy.countryCode}
            options={countryOptions}
            disabled={isPending}
            placeholder={copy.countryCode.placeholder}
          />

          <SelectField
            control={form.control}
            name="stateId"
            copy={copy.stateId}
            options={stateOptions}
            disabled={
              isPending || !selectedCountryCode || stateOptions.length === 0
            }
            placeholder={
              selectedCountryCode
                ? copy.stateId.placeholder
                : copy.stateDisabledPlaceholder
            }
          />

          <SelectField
            control={form.control}
            name="defaultCurrency"
            copy={copy.defaultCurrency}
            options={currencyOptions}
            disabled={isPending}
            placeholder={copy.defaultCurrency.placeholder}
          />

          <SelectField
            control={form.control}
            name="timezone"
            copy={copy.timezone}
            options={timezoneOptions}
            disabled={isPending}
            placeholder={copy.timezone.placeholder}
          />
        </div>

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
