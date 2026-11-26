import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import type {
  PartyRole,
  PartyType,
  PartySalutation,
} from "../types.js"

export function usePartyLabels() {
  const { t } = useTranslation("party")

  const getRoleLabel = useCallback(
    (role: PartyRole) => t(`labels.roles.${role}`, { defaultValue: role }),
    [t]
  )

  const getTypeLabel = useCallback(
    (type: PartyType) => t(`labels.types.${type}`, { defaultValue: type }),
    [t]
  )

  const getSalutationLabel = useCallback(
    (salutation: PartySalutation | null | undefined) => {
      if (!salutation) return ""
      return t(`labels.salutations.${salutation}`, { defaultValue: salutation })
    },
    [t]
  )

  const getStatusLabel = useCallback(
    (isActive: boolean) =>
      t(`labels.status.${isActive ? "active" : "inactive"}`, {
        defaultValue: isActive ? "Active" : "Inactive",
      }),
    [t]
  )

  return {
    getRoleLabel,
    getTypeLabel,
    getSalutationLabel,
    getStatusLabel,
  }
}
