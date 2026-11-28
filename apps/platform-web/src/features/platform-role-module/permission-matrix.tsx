import { PLATFORM_MODULES } from "@avuny/contracts/platform-admin"

import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"

export type PermissionMatrixLabels = {
  /** Resource key -> localized name, e.g. "platform-plan" -> "Plans". */
  resources: Record<string, string>
  /** Action key -> localized name, e.g. "publish_now" -> "Apply now". */
  actions: Record<string, string>
}

type PermissionMatrixProps = {
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  labels: PermissionMatrixLabels
  /** Already localized. */
  legend: string
  /** Already localized. */
  help: string
}

/**
 * The permission picker: one group per registry resource, one checkbox per
 * action (PA-R1: only registry keys exist here). Pure UI: no i18n or API.
 */
export function PermissionMatrix({
  selected,
  onChange,
  disabled,
  labels,
  legend,
  help,
}: PermissionMatrixProps) {
  const selectedSet = new Set(selected)

  const toggle = (key: string, checked: boolean) => {
    onChange(
      checked ? [...selected, key] : selected.filter((item) => item !== key)
    )
  }

  const toggleResource = (resource: string, actions: readonly string[], checked: boolean) => {
    const keys = actions.map((action) => `${action}:${resource}`)
    onChange(
      checked
        ? [...selected, ...keys.filter((key) => !selectedSet.has(key))]
        : selected.filter((key) => !keys.includes(key))
    )
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <p className="text-xs text-muted-foreground">{help}</p>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3">
        {Object.entries(PLATFORM_MODULES).map(([resource, actions]) => {
          const keys = actions.map((action) => `${action}:${resource}`)
          const allSelected = keys.every((key) => selectedSet.has(key))
          return (
            <div key={resource} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`pm-${resource}`}
                  checked={allSelected}
                  onCheckedChange={(checked) =>
                    toggleResource(resource, actions, checked === true)
                  }
                  disabled={disabled}
                />
                <Label
                  htmlFor={`pm-${resource}`}
                  className="text-sm font-medium text-foreground"
                >
                  {labels.resources[resource] ?? resource}
                </Label>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-6">
                {actions.map((action) => {
                  const key = `${action}:${resource}`
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`pm-${key}`}
                        checked={selectedSet.has(key)}
                        onCheckedChange={(checked) =>
                          toggle(key, checked === true)
                        }
                        disabled={disabled}
                      />
                      <Label
                        htmlFor={`pm-${key}`}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        {labels.actions[action] ?? action}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
