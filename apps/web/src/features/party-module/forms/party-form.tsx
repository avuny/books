import { useFieldArray, type UseFormReturn } from "react-hook-form"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { FormShell, SubmitButton } from "@workspace/ui/blocks/form"

import { ContactCollectionEditor } from "./contact-collection-editor.js"
import { EmailRow } from "./email-row.js"
import { PhoneRow } from "./phone-row.js"
import { AddressRow } from "./address-row.js"
import type { PartyFormCopy } from "./party-form-types.js"
import type {
  FormAddressRow,
  FormEmailRow,
  FormPhoneRow,
  PartyFormValues,
  PartyRole,
} from "../types.js"

export interface PartyFormProps {
  form: UseFormReturn<PartyFormValues>
  copy: PartyFormCopy
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>
  isPending: boolean
  errorMessage?: string | null
  isUpdate?: boolean
  canAddOppositeRole?: boolean
  oppositeRole?: PartyRole
  onCancel?: () => void
}

export function PartyForm({
  form,
  copy,
  onSubmit,
  isPending,
  errorMessage,
  isUpdate = false,
  canAddOppositeRole = false,
  oppositeRole,
  onCancel,
}: PartyFormProps) {
  const partyType = form.watch("partyType")
  const roles = form.watch("roles") || []

  const emailFieldArray = useFieldArray({
    control: form.control,
    name: "emails",
    keyName: "contactId",
  })

  const phoneFieldArray = useFieldArray({
    control: form.control,
    name: "phones",
    keyName: "contactId",
  })

  const addressFieldArray = useFieldArray({
    control: form.control,
    name: "addresses",
    keyName: "contactId",
  })

  // Opposite role checkbox handler
  const isOppositeChecked = oppositeRole ? roles.includes(oppositeRole) : false
  const handleOppositeChange = (checked: boolean) => {
    if (!oppositeRole) return
    const currentRoles = form.getValues("roles") || []
    if (checked) {
      if (!currentRoles.includes(oppositeRole)) {
        form.setValue("roles", [...currentRoles, oppositeRole])
      }
    } else {
      form.setValue(
        "roles",
        currentRoles.filter((r) => r !== oppositeRole)
      )
    }
  }

  // When switching partyType to ORGANIZATION, clear salutation
  const handlePartyTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextType = e.target.value as PartyFormValues["partyType"]
    form.setValue("partyType", nextType)
    if (nextType === "ORGANIZATION") {
      form.setValue("salutation", null)
    }
  }

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form onSubmit={onSubmit} className="space-y-6">

      {/* Basic Information */}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Party Type */}
          <div className="space-y-2">
            <Label htmlFor="party-type-select">{copy.partyType.label}</Label>
            <select
              id="party-type-select"
              disabled={isUpdate}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 disabled:opacity-50"
              value={partyType}
              onChange={handlePartyTypeChange}
            >
              {copy.partyType.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Salutation (PERSON only) */}
          {partyType === "PERSON" ? (
            <div className="space-y-2">
              <Label htmlFor="salutation-select">{copy.salutation.label}</Label>
              <select
                id="salutation-select"
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1"
                {...form.register("salutation")}
              >
                <option value="">{copy.salutation.placeholder}</option>
                {copy.salutation.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">{copy.displayName.label}</Label>
          <Input
            id="displayName"
            placeholder={copy.displayName.placeholder}
            {...form.register("displayName")}
          />
          {form.formState.errors.displayName ? (
            <span className="text-destructive text-xs">
              {form.formState.errors.displayName.message}
            </span>
          ) : null}
        </div>

        {/* Legal Name & Tax Number */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legalName">{copy.legalName.label}</Label>
            <Input
              id="legalName"
              placeholder={copy.legalName.placeholder}
              {...form.register("legalName")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxNumber">{copy.taxNumber.label}</Label>
            <Input
              id="taxNumber"
              placeholder={copy.taxNumber.placeholder}
              {...form.register("taxNumber")}
            />
          </div>
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website">{copy.website.label}</Label>
          <Input
            id="website"
            type="url"
            dir="ltr"
            placeholder={copy.website.placeholder}
            {...form.register("website")}
          />
          {form.formState.errors.website ? (
            <span className="text-destructive text-xs">
              {form.formState.errors.website.message}
            </span>
          ) : null}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">{copy.notes.label}</Label>
          <Textarea
            id="notes"
            rows={3}
            placeholder={copy.notes.placeholder}
            {...form.register("notes")}
          />
        </div>

        {/* Opposite role checkbox (on create only) */}
        {!isUpdate && canAddOppositeRole && oppositeRole ? (
          <div className="bg-muted/40 border-border flex items-center gap-2 rounded-lg border p-3">
            <Checkbox
              id="also-add-opposite"
              checked={isOppositeChecked}
              onCheckedChange={(checked) => handleOppositeChange(Boolean(checked))}
            />
            <Label htmlFor="also-add-opposite" className="cursor-pointer text-sm font-normal">
              {copy.alsoAddOpposite.label}
            </Label>
          </div>
        ) : null}
      </div>

      <hr className="border-border" />

      {/* Email Collection */}
      <ContactCollectionEditor<FormEmailRow>
        title={copy.emails.title}
        addLabel={copy.emails.add}
        fieldArray={emailFieldArray}
        form={form}
        fieldName="emails"
        createNewItem={(): FormEmailRow => ({ email: "", label: "", isPrimary: false })}
        renderRow={(idx, onRemove, onSetPrimary) => (
          <EmailRow
            index={idx}
            form={form}
            copy={copy.emails}
            onRemove={onRemove}
            onSetPrimary={onSetPrimary}
          />
        )}
      />

      <hr className="border-border" />

      {/* Phone Collection */}
      <ContactCollectionEditor<FormPhoneRow>
        title={copy.phones.title}
        addLabel={copy.phones.add}
        fieldArray={phoneFieldArray}
        form={form}
        fieldName="phones"
        createNewItem={(): FormPhoneRow => ({ phone: "", label: "", isPrimary: false })}
        renderRow={(idx, onRemove, onSetPrimary) => (
          <PhoneRow
            index={idx}
            form={form}
            copy={copy.phones}
            onRemove={onRemove}
            onSetPrimary={onSetPrimary}
          />
        )}
      />

      <hr className="border-border" />

      {/* Address Collection */}
      <ContactCollectionEditor<FormAddressRow>
        title={copy.addresses.title}
        addLabel={copy.addresses.add}
        fieldArray={addressFieldArray}
        form={form}
        fieldName="addresses"
        createNewItem={(): FormAddressRow => ({
          label: "",
          addressLine1: "",
          addressLine2: "",
          city: "",
          state: "",
          postalCode: "",
          countryCode: "",
          isPrimary: false,
        })}
        renderRow={(idx, onRemove, onSetPrimary) => (
          <AddressRow
            index={idx}
            form={form}
            copy={copy.addresses}
            onRemove={onRemove}
            onSetPrimary={onSetPrimary}
          />
        )}
      />

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-4">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onCancel}
            >
              {copy.cancelLabel}
            </Button>
          ) : null}
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
