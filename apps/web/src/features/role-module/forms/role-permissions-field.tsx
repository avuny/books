import { Checkbox } from "@workspace/ui/components/checkbox"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import {
  countHiddenStatements,
  getGroupSelectionState,
  hasGrant,
  setGroupPermissions,
  togglePermission,
} from "../lib"
import type { PermissionGroup, PermissionStatementDto } from "../types"
import type {
  RolePermissionsFieldCopy,
  RolePermissionsOptions,
} from "./role-form-types"

export interface RolePermissionsFieldProps {
  copy: RolePermissionsFieldCopy
  options: RolePermissionsOptions
  /** The role's full statement list. Statements the picker can't show are kept. */
  value: PermissionStatementDto[]
  onChange: (value: PermissionStatementDto[]) => void
  disabled?: boolean
  /** Already localized. */
  errorMessage?: string
  className?: string
}

/** Pick catalog permissions: one card per resource with a select-all header. */
export function RolePermissionsField({
  copy,
  options,
  value,
  onChange,
  disabled = false,
  errorMessage,
  className,
}: RolePermissionsFieldProps) {
  const { groups, isLoading, getResourceLabel, getActionLabel } = options
  const hiddenCount = isLoading ? 0 : countHiddenStatements(value, groups)

  return (
    <fieldset
      className={cn("grid gap-3", className)}
      aria-busy={isLoading}
      aria-invalid={errorMessage ? true : undefined}
    >
      <div className="grid gap-1">
        <legend className="text-sm font-medium text-foreground">
          {copy.label}
        </legend>
        {copy.description ? (
          <p className="text-xs text-muted-foreground">{copy.description}</p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <div className="grid max-h-72 gap-3 overflow-y-auto pe-1">
          {groups.map((group) => (
            <PermissionGroupCard
              key={group.resource}
              group={group}
              value={value}
              onChange={onChange}
              disabled={disabled}
              resourceLabel={getResourceLabel(group.resource)}
              getActionLabel={getActionLabel}
            />
          ))}
        </div>
      )}

      {hiddenCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {copy.advancedNote(hiddenCount)}
        </p>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  )
}

interface PermissionGroupCardProps {
  group: PermissionGroup
  value: PermissionStatementDto[]
  onChange: (value: PermissionStatementDto[]) => void
  disabled: boolean
  resourceLabel: string
  getActionLabel: (action: string) => string
}

function PermissionGroupCard({
  group,
  value,
  onChange,
  disabled,
  resourceLabel,
  getActionLabel,
}: PermissionGroupCardProps) {
  const state = getGroupSelectionState(value, group)

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Checkbox
          checked={state === "all"}
          indeterminate={state === "some"}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange(setGroupPermissions(value, group, !!checked))
          }
        />
        {resourceLabel}
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2 ps-6 sm:grid-cols-3">
        {group.actions.map((action) => (
          <label
            key={action}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Checkbox
              checked={hasGrant(value, action, group.resource)}
              disabled={disabled}
              onCheckedChange={() =>
                onChange(togglePermission(value, action, group.resource))
              }
            />
            {getActionLabel(action)}
          </label>
        ))}
      </div>
    </div>
  )
}
