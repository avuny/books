import { useState } from "react"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeRole, useCreateRoleMutation } from "../role-api"
import type { RoleDto } from "../types"
import { CreateRoleForm, type CreateRoleFormValues } from "./create-role-form"
import {
  useRoleFormCopy,
  useRolePermissionsOptions,
} from "./use-role-form-copy"

type CreateRoleProps = {
  orgId: string
  onSuccess?: (role: RoleDto) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateRole({ orgId, onSuccess }: CreateRoleProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const createMutation = useCreateRoleMutation(orgId)
  const copy = useRoleFormCopy("create")
  const permissions = useRolePermissionsOptions()

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateRoleFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: { ...values, description: values.description?.trim() || null },
      })
      onSuccess?.(normalizeRole(response.data))
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || null)
    }
  }

  return (
    <CreateRoleForm
      copy={copy}
      permissions={permissions}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
