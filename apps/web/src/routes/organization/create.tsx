import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import DashboardButton from "@/components/buttons/dashboard-button"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { CreateOrganization } from "@/features/organization"

export const Route = createFileRoute("/organization/create")({
  component: CreateOrganizationRoute,
})

function CreateOrganizationRoute() {
  const navigate = useNavigate()

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
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <CreateOrganization
          onSuccess={(org) => {
            void navigate({
              to: "/organization/$orgId",
              params: { orgId: org.id },
            })
          }}
          onClickOnCancelButton={() => {
            void navigate({
              to: "/organization",
              search: { all: true },
            })
          }}
        />
      </div>
    </>
  )
}
