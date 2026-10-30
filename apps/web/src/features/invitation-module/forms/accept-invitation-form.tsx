import { useForm } from "react-hook-form"
import { AcceptMyInvitationSchema } from "@avuny/contracts"

import { InputField, SubmitButton } from "@workspace/ui/blocks/form"

import { createPreparedResolver } from "../lib"
import type { AcceptMyInvitationInput } from "../types"
import type { AcceptInvitationFormCopy } from "./invitation-form-types"
import {
  toAcceptInvitationInput,
  type AcceptInvitationFormValues,
} from "./invitation-form-values"

const resolver = createPreparedResolver<
  AcceptInvitationFormValues,
  AcceptMyInvitationInput
>(AcceptMyInvitationSchema, toAcceptInvitationInput)

type AcceptInvitationFormProps = {
  copy: AcceptInvitationFormCopy
  /** Ask for a username: the inviter did not choose one for this person. */
  showUsername: boolean
  onSubmit: (values: AcceptMyInvitationInput) => void
  isPending: boolean
  /** Already localized. Shown above the button. */
  errorMessage?: string | null
}

// UI + validation only. The caller supplies the heading and decides what happens next.
export function AcceptInvitationForm({
  copy,
  showUsername,
  onSubmit,
  isPending,
  errorMessage,
}: AcceptInvitationFormProps) {
  const form = useForm<
    AcceptInvitationFormValues,
    unknown,
    AcceptMyInvitationInput
  >({
    resolver,
    defaultValues: { username: "" },
  })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="space-y-4"
    >
      {showUsername ? (
        <InputField
          control={form.control}
          name="username"
          copy={copy.username}
          type="text"
          autoComplete="off"
          autoFocus
          disabled={isPending}
        />
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <SubmitButton
        className="w-full"
        loading={isPending}
        label={copy.submitLabel}
        loadingLabel={copy.submittingLabel}
      />
    </form>
  )
}
