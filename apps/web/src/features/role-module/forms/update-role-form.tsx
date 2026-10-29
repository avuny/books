import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { UpdateRoleSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import type { PermissionStatementDto, RoleDto, UpdateRoleInput } from "../types"
import type { RoleFormCopy, RolePermissionsOptions } from "./role-form-types"
import { RolePermissionsField } from "./role-permissions-field"

import type { z } from "@avuny/zod"

export type UpdateRoleFormValues = UpdateRoleInput
type UpdateRoleFormInput = z.input<typeof UpdateRoleSchema>

type UpdateRoleFormProps = {
  copy: RoleFormCopy
  permissions: RolePermissionsOptions
  /** The role being edited; its values pre-fill the form. */
  role: RoleDto
  onSubmit: (values: UpdateRoleFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function UpdateRoleForm({
  copy,
  permissions,
  role,
  onSubmit,
  isPending,
  errorMessage,
}: UpdateRoleFormProps) {
  const form = useForm<UpdateRoleFormInput, unknown, UpdateRoleFormValues>({
    resolver: zodResolver(UpdateRoleSchema),
    defaultValues: {
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions,
    },
  })

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
        <InputField
          control={form.control}
          name="name"
          copy={copy.name}
          type="text"
          autoComplete="off"
          autoFocus
          disabled={isPending}
        />

        <InputField
          control={form.control}
          name="description"
          copy={copy.roleDescription}
          type="text"
          autoComplete="off"
          disabled={isPending}
        />

        <Controller
          control={form.control}
          name="permissions"
          render={({ field, fieldState }) => (
            <RolePermissionsField
              copy={copy.permissions}
              options={permissions}
              value={(field.value ?? []) as PermissionStatementDto[]}
              onChange={field.onChange}
              disabled={isPending}
              errorMessage={fieldState.error?.message}
            />
          )}
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
