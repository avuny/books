import { useCallback } from "react"
import { useTranslation } from "react-i18next"

/**
 * Resolves the labels that ship in the contracts `role` locale:
 * labels.resources.<resource>, labels.actions.<action> (both include "*"),
 * labels.effects.<allow|deny> and labels.systemRoles.<name>.
 * Unknown tokens fall back to the raw value, so a new catalog entry or system
 * role never renders a missing-key string.
 */
export function usePermissionLabels() {
  const { t } = useTranslation("role")

  const getResourceLabel = useCallback(
    (resource: string) =>
      t(`labels.resources.${resource}`, { defaultValue: resource }),
    [t]
  )

  const getActionLabel = useCallback(
    (action: string) => t(`labels.actions.${action}`, { defaultValue: action }),
    [t]
  )

  const getEffectLabel = useCallback(
    (effect: "allow" | "deny") => t(`labels.effects.${effect}`),
    [t]
  )

  /** System role names are stable keys; custom role names are shown as typed. */
  const getRoleName = useCallback(
    (role: { name: string; isSystem: boolean }) =>
      role.isSystem
        ? t(`labels.systemRoles.${role.name}`, { defaultValue: role.name })
        : role.name,
    [t]
  )

  return { getResourceLabel, getActionLabel, getEffectLabel, getRoleName }
}
