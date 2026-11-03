import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { InvitationStatus } from "../types"

/**
 * Resolves the status labels (labels.<status>).
 */
export function useInvitationLabels() {
  const { t } = useTranslation("organization-invitation")

  const getStatusLabel = useCallback(
    (status: InvitationStatus) =>
      t(`labels.${status}`, { defaultValue: status }),
    [t]
  )

  return { getStatusLabel }
}
