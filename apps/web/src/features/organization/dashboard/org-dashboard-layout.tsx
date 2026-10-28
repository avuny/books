import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { Settings2Icon } from "lucide-react"

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import DashboardButton from "@/components/buttons/dashboard-button"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { OrganizationSwitcher } from "../list/organization-switcher"
import { OrgDashboardSidebar } from "./org-dashboard-sidebar"

export type OrgDashboardLayoutProps = {
  orgId: string
  children: ReactNode
}

export function OrgDashboardLayout({
  orgId,
  children,
}: OrgDashboardLayoutProps) {
  return (
    <SidebarProvider>
      <OrgDashboardSidebar orgId={orgId} />
      <SidebarInset>
        <Navbar
          start={
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <HomeButton />
              <DashboardButton />
            </div>
          }
          end={
            <div className="flex items-center gap-2">
              <OrganizationSwitcher currentOrgId={orgId} />
              <Link
                to="/organization/$orgId/settings"
                params={{ orgId }}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "size-8 text-muted-foreground hover:text-foreground"
                )}
                title="Organization settings"
              >
                <Settings2Icon className="size-4" />
                <span className="sr-only">Organization settings</span>
              </Link>
              <UserButton />
              <ModeSwitcherBtn />
              <LanguageSwitcherButton />
            </div>
          }
        />
        <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
