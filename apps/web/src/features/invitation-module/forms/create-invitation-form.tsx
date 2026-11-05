import { useForm } from "react-hook-form"
import { CreateOrganizationInvitationSchema } from "@avuny/contracts"

import {
  AsyncComboboxField,
  FormShell,
  InputField,
  SubmitButton,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
  type ComboboxCreateAction,
} from "@workspace/ui/blocks/form"

import { createPreparedResolver } from "../lib"
import type { CreateOrganizationInvitationInput } from "../types"
import type { InvitationFormCopy } from "./invitation-form-types"
import {
  CREATE_INVITATION_DEFAULTS,
  toCreateInvitationInput,
  type CreateInvitationFormValues,
} from "./invitation-form-values"

export type CreateInvitationFormSubmit = CreateOrganizationInvitationInput

// Validates the contract schema on the blank-cleaned values (see the resolver).
const resolver = createPreparedResolver<
  CreateInvitationFormValues,
  CreateInvitationFormSubmit
>(CreateOrganizationInvitationSchema, toCreateInvitationInput)

type CreateInvitationFormProps = {
  copy: InvitationFormCopy
  /** Strings for the role combobox's loading, empty and error states. */
  roleCombobox: AsyncComboboxCopy
  roleSource: AsyncOptionsSource
  /** Leave undefined to hide the "Create new" button. */
  roleCreateAction?: ComboboxCreateAction
  onSubmit: (values: CreateInvitationFormSubmit) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateInvitationForm({
  copy,
  roleCombobox,
  roleSource,
  roleCreateAction,
  onSubmit,
  isPending,
  errorMessage,
}: CreateInvitationFormProps) {
  const form = useForm<
    CreateInvitationFormValues,
    unknown,
    CreateInvitationFormSubmit
  >({
    resolver,
    defaultValues: CREATE_INVITATION_DEFAULTS,
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
        className="space-y-4"
      >
        <InputField
          control={form.control}
          name="identifier"
          copy={copy.identifier}
          type="email"
          autoComplete="off"
          autoFocus
          disabled={isPending}
        />

        <AsyncComboboxField
          control={form.control}
          name="roleId"
          copy={copy.role}
          comboboxCopy={roleCombobox}
          source={roleSource}
          createAction={roleCreateAction}
          disabled={isPending}
          placeholder={copy.role.placeholder}
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
