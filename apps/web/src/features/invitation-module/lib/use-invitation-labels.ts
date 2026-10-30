import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type {
  InvitableMemberType,
  InvitationChannel,
  InvitationStatus,
} from "../types"

/**
 * Resolves the labels that ship in the contracts `organization-invitation` locale
 * (labels.<status>, labels.<channel>) plus the member-type names (types.<type>).
 * Unknown tokens fall back to the raw value, so a new status or channel never
 * renders a missing-key string.
 */
export function useInvitationLabels() {
  const { t } = useTranslation("organization-invitation")

  const getStatusLabel = useCallback(
    (status: InvitationStatus) => t(`labels.${status}`, { defaultValue: status }),
    [t]
  )

  const getChannelLabel = useCallback(
    (channel: InvitationChannel) =>
      t(`labels.${channel}`, { defaultValue: channel }),
    [t]
  )

  const getTypeLabel = useCallback(
    (type: InvitableMemberType) => t(`types.${type}`, { defaultValue: type }),
    [t]
  )

  return { getStatusLabel, getChannelLabel, getTypeLabel }
}
