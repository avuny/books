import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { RoleDto } from "@avuny/contracts"

import { useCreateOption } from "@workspace/ui/blocks/form"
import { parseApiError } from "@workspace/ui/lib/api-error"



// Stand-in for your role create UI. It only needs open / onOpenChange / onSuccess(role).


import { useCreateInvitationMutation } from "../invitation-api"
import type { OrganizationInvitationDto } from "../types"
import {
  CreateInvitationForm,
  type CreateInvitationFormSubmit,
} from "./create-invitation-form"
import { useInvitationFormCopy } from "./use-invitation-form-copy"
import { useRoleOptions } from "@/features/role-module/role-api"
import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"
import { CreateRoleDialog } from "./create-role-dialog"

type CreateInvitationProps = {
  orgId: string
  /** Pass false to hide "Create new role" (no create:role permission, or the plan lacks customRoles). */
  canCreateRole?: boolean
  onSuccess?: (invitation: OrganizationInvitationDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateInvitation({
  orgId,
  canCreateRole = true,
  onSuccess,
}: CreateInvitationProps) {
  const { t } = useTranslation("organization-invitation")
  const [serverError, setServerError] = useState<string | null>(null)

  const createMutation = useCreateInvitationMutation(orgId)
  const roleSource = useRoleOptions(orgId)
  const roleCombobox = useAsyncComboboxCopy()
  const createRole = useCreateOption((role: RoleDto) => ({
    id: role.id,
    name: role.name,
  }))
  const copy = useInvitationFormCopy()

  // Called only when Zod validation passes (the resolver guards the fields).
  const handleSubmit = async (values: CreateInvitationFormSubmit) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: values,
      })
      onSuccess?.(response.data)
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || null)
    }
  }

  return (
    <>
      <CreateInvitationForm
        copy={copy}
        roleCombobox={roleCombobox}
        roleSource={roleSource}
        roleCreateAction={
          canCreateRole ? createRole.action(t("actions.create")) : undefined
        }
        onSubmit={handleSubmit}
        isPending={createMutation.isPending}
        errorMessage={serverError}
      />

      {canCreateRole && (
        <CreateRoleDialog
          orgId={orgId}
          open={createRole.open}
          onOpenChange={createRole.setOpen}
          defaultName={createRole.search} // optional prefill with what the user had typed
          onSuccess={createRole.onCreated}
        />
      )}
    </>
  )
}
