import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"

import type { PlatformListRoles200DataItem as PlatformRoleDto } from "@/api/model"

type RoleCheckboxGroupProps = {
  roles: PlatformRoleDto[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  /** Already localized. */
  label: string
  /** Already localized. */
  help: string
  /** Already localized. Shown when nothing is selected. */
  emptyLabel?: string
}

// Pure picker: roles in, selection out. No i18n, API or navigation knowledge.
export function RoleCheckboxGroup({
  roles,
  selectedIds,
  onChange,
  disabled,
  label,
  help,
  emptyLabel,
}: RoleCheckboxGroupProps) {
  const toggle = (roleId: string, checked: boolean) => {
    onChange(
      checked
        ? [...selectedIds, roleId]
        : selectedIds.filter((id) => id !== roleId)
    )
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <p className="text-xs text-muted-foreground">{help}</p>
      <div className="space-y-2 rounded-md border border-border p-3">
        {roles.map((role) => (
          <div key={role.id} className="flex items-start gap-2">
            <Checkbox
              id={`role-${role.id}`}
              checked={selectedIds.includes(role.id)}
              onCheckedChange={(checked) => toggle(role.id, checked === true)}
              disabled={disabled}
            />
            <Label
              htmlFor={`role-${role.id}`}
              className="flex flex-col gap-0.5 font-normal"
            >
              <span className="text-sm text-foreground">{role.name}</span>
              {role.description && (
                <span className="text-xs text-muted-foreground">
                  {role.description}
                </span>
              )}
            </Label>
          </div>
        ))}
      </div>
      {emptyLabel && selectedIds.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </fieldset>
  )
}
