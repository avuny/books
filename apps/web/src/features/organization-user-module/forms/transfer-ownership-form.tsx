import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { TransferOrganizationOwnershipSchema } from "@avuny/contracts"

import { InputField, SubmitButton } from "@workspace/ui/blocks/form"

import { createPreparedResolver } from "../lib"
import type { TransferOrganizationOwnershipInput } from "../types"
import type { TransferOwnershipFormCopy } from "./member-form-types"
import {
  toTransferOwnershipInput,
  type TransferOwnershipFormValues,
} from "./member-form-values"

type TransferOwnershipFormProps = {
  copy: TransferOwnershipFormCopy
  /** The membership that becomes the new owner. */
  newOwnerMemberId: string
  onSubmit: (values: TransferOrganizationOwnershipInput) => void
  isPending: boolean
  /** Already localized. Shown above the button. */
  errorMessage?: string | null
}

// UI + validation only. The owner retypes the organization code to confirm.
export function TransferOwnershipForm({
  copy,
  newOwnerMemberId,
  onSubmit,
  isPending,
  errorMessage,
}: TransferOwnershipFormProps) {
  // The target comes from props, so the resolver is built per member.
  const resolver = useMemo(
    () =>
      createPreparedResolver<
        TransferOwnershipFormValues,
        TransferOrganizationOwnershipInput
      >(
        TransferOrganizationOwnershipSchema,
        toTransferOwnershipInput(newOwnerMemberId)
      ),
    [newOwnerMemberId]
  )

  const form = useForm<
    TransferOwnershipFormValues,
    unknown,
    TransferOrganizationOwnershipInput
  >({
    resolver,
    defaultValues: { confirmCode: "" },
  })

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      noValidate
      className="space-y-4"
    >
      <InputField
        control={form.control}
        name="confirmCode"
        copy={copy.confirmCode}
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
