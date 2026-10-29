import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { CreateRoleSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import type { CreateRoleInput, PermissionStatementDto } from "../types"
import type { RoleFormCopy, RolePermissionsOptions } from "./role-form-types"
import { RolePermissionsField } from "./role-permissions-field"

import type { z } from "@avuny/zod"

export type CreateRoleFormValues = CreateRoleInput
type CreateRoleFormInput = z.input<typeof CreateRoleSchema>

type CreateRoleFormProps = {
  copy: RoleFormCopy
  permissions: RolePermissionsOptions
  onSubmit: (values: CreateRoleFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateRoleForm({
  copy,
  permissions,
  onSubmit,
  isPending,
  errorMessage,
}: CreateRoleFormProps) {
  const form = useForm<CreateRoleFormInput, unknown, CreateRoleFormValues>({
    resolver: zodResolver(CreateRoleSchema),
    defaultValues: { name: "", description: "", permissions: [] },
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
