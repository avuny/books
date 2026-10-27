import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  CreateOrganizationSchema,
  type CreateOrganizationInput,
} from "@avuny/contracts/organization"

import { Button } from "@workspace/ui/components/button"
import {
  FormShell,
  InputField,
  SelectField,
  SubmitButton,
  type SelectOption,
} from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type CreateOrganizationFormValues = CreateOrganizationInput

export type CreateOrganizationCopy = {
  title: string
  description: string
  name: FieldCopy
  code: FieldCopy
  countryCode: FieldCopy
  stateId: FieldCopy
  stateDisabledPlaceholder: string
  defaultCurrency: FieldCopy
  timezone: FieldCopy
  ownerUsername: FieldCopy
  submitLabel: string
  submittingLabel: string
  cancelLabel?: string
}

type CreateOrganizationFormProps = {
  copy: CreateOrganizationCopy
  countryOptions: SelectOption[]
  stateOptions: SelectOption[]
  currencyOptions: SelectOption[]
  timezoneOptions: SelectOption[]
  selectedCountryCode: string | undefined
  onCountryChange: (countryCode: string) => void
  onSubmit: (values: CreateOrganizationFormValues) => void
  onClickOnCancelButton?: () => void
  isPending: boolean
  errorMessage?: string | null
  defaultOwnerUsername?: string
}

export function CreateOrganizationForm({
  copy,
  countryOptions,
  stateOptions,
  currencyOptions,
  timezoneOptions,
  selectedCountryCode,
  onCountryChange,
  onSubmit,
  onClickOnCancelButton,
  isPending,
  errorMessage,
  defaultOwnerUsername = "",
}: CreateOrganizationFormProps) {
  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      name: "",
      code: "",
      countryCode: null,
      stateId: null,
      defaultCurrency: "USD",
      timezone: "UTC",
      ownerUsername: defaultOwnerUsername,
    },
  })

  // Keep ownerUsername in sync when default arrives after initial load
  useEffect(() => {
    if (defaultOwnerUsername && !form.getValues("ownerUsername")) {
      form.setValue("ownerUsername", defaultOwnerUsername)
    }
  }, [defaultOwnerUsername, form])

  // Sync selected country with container
  const watchedCountry = form.watch("countryCode")
  useEffect(() => {
    if (watchedCountry !== selectedCountryCode) {
      onCountryChange(watchedCountry || "")
      form.setValue("stateId", null)
    }
  }, [watchedCountry, selectedCountryCode, onCountryChange, form])

  // Automatically generate code slug from name if code is empty
  const watchedName = form.watch("name")
  useEffect(() => {
    const currentCode = form.getValues("code")
    if (!currentCode && watchedName) {
      form.setValue("code", slugify(watchedName), { shouldValidate: true })
    }
  }, [watchedName, form])

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField
            control={form.control}
            name="name"
            copy={copy.name}
            type="text"
            autoFocus
            disabled={isPending}
            className="sm:col-span-2"
            action={
              <span className="text-xs text-muted-foreground">
                {form.watch("name")?.length || 0}/255
              </span>
            }
          />

          <InputField
            control={form.control}
            name="code"
            copy={copy.code}
            type="text"
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
            action={undefined}
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

          <InputField
            control={form.control}
            name="ownerUsername"
            copy={copy.ownerUsername}
            type="text"
            disabled={isPending}
            className="sm:col-span-2"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          {onClickOnCancelButton && copy.cancelLabel && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClickOnCancelButton}
            >
              {copy.cancelLabel}
            </Button>
          )}

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 31)
}
