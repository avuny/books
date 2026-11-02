import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useTransferOwnershipMutation } from "../organization-user-api"
import type {
  OrganizationUserDto,
  TransferOrganizationOwnershipInput,
} from "../types"
import { TransferOwnershipForm } from "./transfer-ownership-form"
import { useTransferOwnershipFormCopy } from "./use-member-form-copy"

type TransferOwnershipDialogProps = {
  orgId: string
  /** The member who would become the owner; null keeps the dialog closed. */
  member: OrganizationUserDto | null
  onOpenChange: (open: boolean) => void
  /** Receives the new owner. */
  onSuccess?: (newOwner: OrganizationUserDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function TransferOwnershipDialog({
  orgId,
  member,
  onOpenChange,
  onSuccess,
}: TransferOwnershipDialogProps) {
  const { t } = useTranslation("organization-user")
  const [serverError, setServerError] = useState<string | null>(null)

  const transferMutation = useTransferOwnershipMutation(orgId)
  const copy = useTransferOwnershipFormCopy()

  // Called only when Zod validation passes (the resolver guards the fields).
  const handleSubmit = async (values: TransferOrganizationOwnershipInput) => {
    setServerError(null)
    try {
      const response = await transferMutation.mutateAsync({
        orgId,
        data: values,
      })
      onSuccess?.(response.data)
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) setServerError(null)
        onOpenChange(open)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("transfer.title", { name: member?.username })}
          </DialogTitle>
          <DialogDescription>
            {t("transfer.description", { name: member?.username })}
          </DialogDescription>
        </DialogHeader>

        {member ? (
          <TransferOwnershipForm
            key={member.id}
            copy={copy}
            newOwnerMemberId={member.id}
            onSubmit={handleSubmit}
            isPending={transferMutation.isPending}
            errorMessage={serverError}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
