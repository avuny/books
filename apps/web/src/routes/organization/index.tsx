import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import { useSelectedOrganizationId } from "@workspace/ui/providers/selected-org-provider"
import DashboardButton from "@/components/buttons/dashboard-button"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { OrganizationDashboard } from "@/features/organization"

type OrganizationIndexSearch = {
  all?: boolean
}

export const Route = createFileRoute("/organization/")({
  validateSearch: (
    search: Record<string, unknown>
  ): OrganizationIndexSearch => ({
    all: search.all === true || search.all === "true",
  }),
  component: OrganizationPage,
})

function OrganizationPage() {
  const navigate = useNavigate()
  const { all } = Route.useSearch()
  const selectedOrgId = useSelectedOrganizationId()

  useEffect(() => {
    if (selectedOrgId && !all) {
      void navigate({
        to: "/organization/$orgId",
        params: { orgId: selectedOrgId },
        replace: true,
      })
    }
  }, [selectedOrgId, all, navigate])

  if (selectedOrgId && !all) {
    return null
  }

  return (
    <>
      <Navbar
        start={
          <>
            <HomeButton />
            <DashboardButton />
          </>
        }
        end={
          <>
            <UserButton />
            <ModeSwitcherBtn />
            <LanguageSwitcherButton />
          </>
        }
      />
      <div className="flex-1 overflow-auto">
        <OrganizationDashboard
          onSelectOrganization={(orgId) => {
            void navigate({
              to: "/organization/$orgId",
              params: { orgId },
            })
          }}
          onClickCreateOrganization={() => {
            void navigate({ to: "/organization/create" })
          }}
        />
      </div>
    </>
  )
}
