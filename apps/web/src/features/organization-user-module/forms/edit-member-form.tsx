import { useForm } from "react-hook-form"
import { UpdateOrganizationUserSchema } from "@avuny/contracts"

import { InputField, SubmitButton } from "@workspace/ui/blocks/form"

import { createPreparedResolver } from "../lib"
import type { UpdateOrganizationUserInput } from "../types"
import type { EditMemberFormCopy } from "./member-form-types"
import {
  toEditMemberInput,
  type EditMemberFormValues,
} from "./member-form-values"

const resolver = createPreparedResolver<
  EditMemberFormValues,
  UpdateOrganizationUserInput
>(UpdateOrganizationUserSchema, toEditMemberInput)

type EditMemberFormProps = {
  copy: EditMemberFormCopy
  defaultUsername: string
  onSubmit: (values: UpdateOrganizationUserInput) => void
  isPending: boolean
  /** Already localized. Shown above the button. */
  errorMessage?: string | null
}

// UI + validation only. The caller supplies the heading and decides what happens next.
export function EditMemberForm({
  copy,
  defaultUsername,
  onSubmit,
  isPending,
  errorMessage,
}: EditMemberFormProps) {
  const form = useForm<
    EditMemberFormValues,
    unknown,
    UpdateOrganizationUserInput
  >({
    resolver,
    defaultValues: { username: defaultUsername },
  })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="space-y-4"
    >
      <InputField
        control={form.control}
        name="username"
        copy={copy.username}
        type="text"
        autoComplete="off"
        autoFocus
        disabled={isPending}
      />

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
