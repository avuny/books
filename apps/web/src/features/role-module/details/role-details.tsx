import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { RoleButton } from "../forms"
import { groupStatementsByResource, usePermissionLabels } from "../lib"
import { useRole, useRoleAbilities } from "../role-api"
import { RoleDetailsView } from "./role-details-view"

type RoleDetailsProps = {
  orgId: string
  roleId: string
  /** The route decides where "Back" goes. */
  onBack?: () => void
}

// Composition only: strings + API behavior wired into the pure view.
export function RoleDetails({ orgId, roleId, onBack }: RoleDetailsProps) {
  const { t, i18n } = useTranslation("role")
  const { role, isLoading, error } = useRole(orgId, roleId)
  const abilities = useRoleAbilities(orgId)
  const { getResourceLabel, getActionLabel, getEffectLabel, getRoleName } =
    usePermissionLabels()

  const groups = useMemo(
    () => groupStatementsByResource(role?.permissions ?? []),
    [role?.permissions]
  )

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(iso)
    )

  const canEdit = abilities.canUpdate && role !== null && !role.isSystem

  return (
    <RoleDetailsView
      role={role}
      roleName={role ? getRoleName(role) : ""}
      isLoading={isLoading}
      errorMessage={error ? parseApiError(error).message : null}
      copy={{
        backLabel: t("details.back"),
        systemLabel: t("type.system"),
        customLabel: t("type.custom"),
        systemHint: t("details.systemHint"),
        membersLabel: t("details.members"),
        createdLabel: t("details.createdAt"),
        updatedLabel: t("details.updatedAt"),
        permissionsTitle: t("details.permissionsTitle"),
        summary: {
          empty: t("details.emptyPermissions"),
          denyLabel: getEffectLabel("deny"),
        },
      }}
      groups={groups}
      getResourceLabel={getResourceLabel}
      getActionLabel={getActionLabel}
      createdAt={role ? formatDate(role.createdAt) : ""}
      updatedAt={role ? formatDate(role.updatedAt) : ""}
      onBack={onBack}
      editAction={
        canEdit ? <RoleButton orgId={orgId} roleId={roleId} /> : undefined
      }
    />
  )
}
