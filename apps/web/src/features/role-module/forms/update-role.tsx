import { useState } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeRole, useRole, useUpdateRoleMutation } from "../role-api"
import type { RoleDto } from "../types"
import { UpdateRoleForm, type UpdateRoleFormValues } from "./update-role-form"
import {
  useRoleFormCopy,
  useRolePermissionsOptions,
} from "./use-role-form-copy"

type UpdateRoleProps = {
  orgId: string
  /** The list rows don't carry permissions, so the role is loaded by id. */
  roleId: string
  onSuccess?: (role: RoleDto) => void
}

// Composition only: loads the role, wires strings + API behavior into the pure form.
export function UpdateRole({ orgId, roleId, onSuccess }: UpdateRoleProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const { role, isLoading, error } = useRole(orgId, roleId)
  const updateMutation = useUpdateRoleMutation(orgId)
  const copy = useRoleFormCopy("update")
  const permissions = useRolePermissionsOptions()

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: UpdateRoleFormValues) => {
    setServerError(null)
    try {
      const response = await updateMutation.mutateAsync({
        orgId,
        roleId,
        data: { ...values, description: values.description?.trim() || null },
      })
      onSuccess?.(normalizeRole(response.data))
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || null)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!role) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error ? parseApiError(error).message : null}
      </p>
    )
  }

  return (
    <UpdateRoleForm
      copy={copy}
      permissions={permissions}
      role={role}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
    />
  )
}
