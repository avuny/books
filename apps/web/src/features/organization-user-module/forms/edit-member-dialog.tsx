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

import { useUpdateMemberMutation } from "../organization-user-api"
import type { OrganizationUserDto, UpdateOrganizationUserInput } from "../types"
import { EditMemberForm } from "./edit-member-form"
import { useEditMemberFormCopy } from "./use-member-form-copy"

type EditMemberDialogProps = {
  orgId: string
  /** The member being edited; null keeps the dialog closed. */
  member: OrganizationUserDto | null
  onOpenChange: (open: boolean) => void
  onSuccess?: (member: OrganizationUserDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function EditMemberDialog({
  orgId,
  member,
  onOpenChange,
  onSuccess,
}: EditMemberDialogProps) {
  const { t } = useTranslation("organization-user")
  const [serverError, setServerError] = useState<string | null>(null)

  const updateMutation = useUpdateMemberMutation(orgId)
  const copy = useEditMemberFormCopy()

  // Called only when Zod validation passes (the resolver guards the fields).
  const handleSubmit = async (values: UpdateOrganizationUserInput) => {
    if (!member) return
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        memberId: member.id,
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
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription>
            {t("edit.description", { name: member?.username })}
          </DialogDescription>
        </DialogHeader>

        {member ? (
          <EditMemberForm
            key={member.id}
            copy={copy}
            defaultUsername={member.username}
            onSubmit={handleSubmit}
            isPending={updateMutation.isPending}
            errorMessage={serverError}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
