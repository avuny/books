import { useTranslation } from "react-i18next"

import { usePermissionLabels } from "../lib"
import { usePermissionGroups } from "../role-api"
import type { RoleFormCopy, RolePermissionsOptions } from "./role-form-types"

/** Builds the localized strings for the create or update form. */
export function useRoleFormCopy(mode: "create" | "update"): RoleFormCopy {
  const { t } = useTranslation("role")

  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: {
      label: t("fields.name.label"),
      placeholder: t("fields.name.placeholder"),
    },
    roleDescription: {
      label: t("fields.description.label"),
      placeholder: t("fields.description.placeholder"),
    },
    permissions: {
      label: t("fields.permissions.label"),
      description: t("fields.permissions.description"),
      empty: t("fields.permissions.empty"),
      advancedNote: (count) => t("fields.permissions.advancedNote", { count }),
    },
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}

/** Permission catalog + localized labels for the permissions field. */
export function useRolePermissionsOptions(): RolePermissionsOptions {
  const { groups, isLoading } = usePermissionGroups()
  const { getResourceLabel, getActionLabel } = usePermissionLabels()

  return { groups, isLoading, getResourceLabel, getActionLabel }
}
