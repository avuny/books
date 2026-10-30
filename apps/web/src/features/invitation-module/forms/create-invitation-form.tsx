import { Controller, useForm, useWatch } from "react-hook-form"
import {
  CreateOrganizationInvitationSchema,
  INVITABLE_MEMBER_TYPES,
  INVITATION_CHANNELS,
} from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import { createPreparedResolver } from "../lib"
import type { CreateOrganizationInvitationInput } from "../types"
import { InvitationChoiceField } from "./invitation-choice-field"
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
  onSubmit: (values: CreateInvitationFormSubmit) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateInvitationForm({
  copy,
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
  const channel = useWatch({ control: form.control, name: "channel" })

  const typeOptions = INVITABLE_MEMBER_TYPES.map((value) => ({
    value,
    ...copy.type.options[value],
  }))
  const channelOptions = INVITATION_CHANNELS.map((value) => ({
    value,
    ...copy.channel.options[value],
  }))

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
        <Controller
          control={form.control}
          name="type"
          render={({ field, fieldState }) => (
            <InvitationChoiceField
              name={field.name}
              legend={copy.type.legend}
              options={typeOptions}
              value={field.value}
              onChange={field.onChange}
              disabled={isPending}
              errorMessage={fieldState.error?.message}
            />
          )}
        />

        <Controller
          control={form.control}
          name="channel"
          render={({ field, fieldState }) => (
            <InvitationChoiceField
              name={field.name}
              legend={copy.channel.legend}
              options={channelOptions}
              value={field.value}
              onChange={field.onChange}
              disabled={isPending}
              errorMessage={fieldState.error?.message}
            />
          )}
        />

        {channel === "email" ? (
          <InputField
            control={form.control}
            name="email"
            copy={copy.email}
            type="email"
            autoComplete="off"
            autoFocus
            disabled={isPending}
          />
        ) : (
          <InputField
            control={form.control}
            name="phone"
            copy={copy.phone}
            type="tel"
            autoComplete="off"
            autoFocus
            disabled={isPending}
          />
        )}

        <InputField
          control={form.control}
          name="username"
          copy={copy.username}
          type="text"
          autoComplete="off"
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
