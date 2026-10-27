import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
  useLocation,
} from "@tanstack/react-router"
import { Settings2Icon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import DashboardButton from "@/components/buttons/dashboard-button"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { OrganizationSwitcher } from "@/features/organization"

export const Route = createFileRoute("/organization/$orgId")({
  component: OrgLayout,
})

function OrgLayout() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isSettings = location.pathname.startsWith(
    `/organization/${orgId}/settings`
  )

  if (isSettings) {
    return <Outlet />
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3 text-sm">
        <div className="flex items-center gap-4">
          <HomeButton />
          <DashboardButton />
          <div className="flex items-center gap-6">
            <Link
              to="/organization"
              search={{ all: true }}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              All organizations
            </Link>
            <Link
              to="/organization/$orgId"
              params={{ orgId }}
              activeOptions={{ exact: true }}
              className="text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "font-semibold text-primary" }}
            >
              Overview
            </Link>
            <Link
              to="/organization/$orgId/role"
              params={{ orgId }}
              className="text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "font-semibold text-primary" }}
            >
              Roles
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <OrganizationSwitcher currentOrgId={orgId} />
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            title="Organization settings"
            onClick={() =>
              void navigate({
                to: "/organization/$orgId/settings",
                params: { orgId },
              })
            }
          >
            <Settings2Icon className="size-4" />
            <span className="sr-only">Organization settings</span>
          </Button>
          <UserButton />
          <ModeSwitcherBtn />
          <LanguageSwitcherButton />
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
