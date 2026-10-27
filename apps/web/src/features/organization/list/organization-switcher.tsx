import { useNavigate, useLocation } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { OrganizationDto } from "@avuny/contracts/organization"

import { useListOrganizations } from "@/api"
import { useSelectedOrganizationContext } from "@workspace/ui/providers/selected-org-provider"
import {
  OrganizationCombobox,
  type OrganizationComboboxCopy,
} from "./organization-combobox"

type OrganizationSwitcherProps = {
  currentOrgId?: string
  className?: string
  onSelectOrganization?: (orgId: string) => void
}

export function OrganizationSwitcher({
  currentOrgId,
  className,
  onSelectOrganization,
}: OrganizationSwitcherProps) {
  const { t } = useTranslation("organization")
  const navigate = useNavigate()
  const location = useLocation()
  const { setSelectedOrganizationId } = useSelectedOrganizationContext()

  const { data, isLoading } = useListOrganizations()
  const organizations: OrganizationDto[] = data?.data?.items ?? []

  const copy: OrganizationComboboxCopy = {
    placeholder: t("list.comboboxPlaceholder"),
    searchPlaceholder: t("list.searchPlaceholder"),
    noResults: t("list.noResults"),
    createAction: t("list.createAction"),
  }

  const handleSelect = (orgId: string) => {
    setSelectedOrganizationId(orgId)

    if (onSelectOrganization) {
      onSelectOrganization(orgId)
      return
    }

    // Preserve settings path if currently inside settings
    if (location.pathname.includes("/settings")) {
      void navigate({
        to: "/organization/$orgId/settings",
        params: { orgId },
      })
    } else {
      void navigate({
        to: "/organization/$orgId",
        params: { orgId },
      })
    }
  }

  const handleCreate = () => {
    void navigate({ to: "/organization/create" })
  }

  return (
    <OrganizationCombobox
      organizations={organizations}
      selectedOrgId={currentOrgId}
      copy={copy}
      onSelect={handleSelect}
      onCreate={handleCreate}
      disabled={isLoading}
      className={className}
    />
  )
}
