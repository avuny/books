import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { MemberStatus } from "../types"

/**
 * Resolves the status labels (labels.<status>).
 */
export function useMemberLabels() {
  const { t } = useTranslation("organization-user")

  const getStatusLabel = useCallback(
    (status: MemberStatus) => t(`labels.${status}`, { defaultValue: status }),
    [t]
  )

  return { getStatusLabel }
}
