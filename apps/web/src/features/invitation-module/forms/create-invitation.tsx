import { useState } from "react"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { useCreateInvitationMutation } from "../invitation-api"
import type { OrganizationInvitationDto } from "../types"
import {
  CreateInvitationForm,
  type CreateInvitationFormSubmit,
} from "./create-invitation-form"
import { useInvitationFormCopy } from "./use-invitation-form-copy"

type CreateInvitationProps = {
  orgId: string
  onSuccess?: (invitation: OrganizationInvitationDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateInvitation({ orgId, onSuccess }: CreateInvitationProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const createMutation = useCreateInvitationMutation(orgId)
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
    <CreateInvitationForm
      copy={copy}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
