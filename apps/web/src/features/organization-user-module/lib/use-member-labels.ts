import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { MemberStatus, OrgMemberType } from "../types"

/**
 * Resolves the labels that ship in the contracts `organization-user` locale
 * (labels.<type>, labels.<status>). Unknown tokens fall back to the raw value,
 * so a new type never renders a missing-key string.
 */
export function useMemberLabels() {
  const { t } = useTranslation("organization-user")

  const getTypeLabel = useCallback(
    (type: OrgMemberType) => t(`labels.${type}`, { defaultValue: type }),
    [t]
  )

  const getStatusLabel = useCallback(
    (status: MemberStatus) => t(`labels.${status}`, { defaultValue: status }),
    [t]
  )

  return { getTypeLabel, getStatusLabel }
}
