import { useTranslation } from "react-i18next"
import type { OrganizationDto } from "@avuny/contracts/organization"

import { useListOrganizations } from "@/api"
import { useSelectedOrganizationContext } from "@workspace/ui/providers/selected-org-provider"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { CreateOrganization } from "../create"
import {
  OrganizationListView,
  type OrganizationListCopy,
} from "./organization-list-view"

type OrganizationDashboardProps = {
  onSelectOrganization: (orgId: string) => void
  onClickCreateOrganization: () => void
}

export function OrganizationDashboard({
  onSelectOrganization,
  onClickCreateOrganization,
}: OrganizationDashboardProps) {
  const { t } = useTranslation("organization")
  const { selectedOrganizationId, setSelectedOrganizationId } =
    useSelectedOrganizationContext()

  const { data, isLoading } = useListOrganizations()

  const organizations: OrganizationDto[] = data?.data?.items ?? []

  const copy: OrganizationListCopy = {
    title: t("list.title"),
    description: t("list.description"),
    emptyTitle: t("list.emptyTitle"),
    emptyDescription: t("list.emptyDescription"),
    createButton: t("list.createButton"),
    combobox: {
      placeholder: t("list.comboboxPlaceholder"),
      searchPlaceholder: t("list.searchPlaceholder"),
      noResults: t("list.noResults"),
      createAction: t("list.createAction"),
    },
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8 p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // If no organizations exist for user, render create organization form
  if (organizations.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 md:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {copy.emptyTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.emptyDescription}
          </p>
        </div>

        <CreateOrganization
          onSuccess={(newOrg) => {
            onSelectOrganization(newOrg.id)
          }}
        />
      </div>
    )
  }

  const handleSelect = (id: string) => {
    setSelectedOrganizationId(id)
    onSelectOrganization(id)
  }

  return (
    <OrganizationListView
      organizations={organizations}
      selectedOrgId={selectedOrganizationId}
      copy={copy}
      onSelectOrganization={handleSelect}
      onClickCreateOrganization={onClickCreateOrganization}
    />
  )
}
