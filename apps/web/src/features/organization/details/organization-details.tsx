import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import type { OrganizationDto } from "@avuny/contracts/organization"

import { useGetOrganization, useListOrganizations } from "@/api"
import { useSelectedOrganizationContext } from "@workspace/ui/providers/selected-org-provider"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  OrganizationDetailsView,
  type OrganizationDetailsCopy,
} from "./organization-details-view"

type OrganizationDetailsProps = {
  orgId: string
  onSelectOrganization: (id: string) => void
  onNavigateToAll: () => void
  onNavigateToCreate: () => void
}

export function OrganizationDetails({
  orgId,
  onSelectOrganization,
  onNavigateToAll,
  onNavigateToCreate,
}: OrganizationDetailsProps) {
  const { t } = useTranslation("organization")
  const { setSelectedOrganizationId } = useSelectedOrganizationContext()

  const orgQuery = useGetOrganization(orgId)
  const orgsListQuery = useListOrganizations()

  // Ensure cookie is in sync when on details page
  useEffect(() => {
    if (orgId) {
      setSelectedOrganizationId(orgId)
    }
  }, [orgId, setSelectedOrganizationId])

  const copy: OrganizationDetailsCopy = {
    title: t("details.title"),
    description: t("details.description"),
    id: t("details.id"),
    code: t("details.code"),
    name: t("details.name"),
    status: t("details.status"),
    currency: t("details.currency"),
    timezone: t("details.timezone"),
    country: t("details.country"),
    state: t("details.state"),
    allOrganizations: t("details.allOrganizations"),
    switchOrganization: t("details.switchOrganization"),
    none: t("details.none"),
    combobox: {
      placeholder: t("list.comboboxPlaceholder"),
      searchPlaceholder: t("list.searchPlaceholder"),
      noResults: t("list.noResults"),
      createAction: t("list.createAction"),
    },
  }

  if (orgQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8 p-6 md:p-8">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    )
  }

  const organization = orgQuery.data?.data
  if (!organization) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6 md:p-8">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
          <p className="font-semibold">{t("errors.ORGANIZATION_NOT_FOUND")}</p>
        </div>
      </div>
    )
  }

  const allOrganizations: OrganizationDto[] =
    orgsListQuery.data?.data?.items ?? []

  return (
    <OrganizationDetailsView
      organization={organization}
      allOrganizations={allOrganizations}
      copy={copy}
      onSelectOrganization={onSelectOrganization}
      onNavigateToAll={onNavigateToAll}
      onNavigateToCreate={onNavigateToCreate}
    />
  )
}
