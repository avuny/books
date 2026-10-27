import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

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
import { OrgSettingsSidebar } from "./org-settings-sidebar"

export type OrgSettingsLayoutProps = {
  orgId: string
  children: ReactNode
}

export function OrgSettingsLayout({ orgId, children }: OrgSettingsLayoutProps) {
  return (
    <SidebarProvider>
      <OrgSettingsSidebar orgId={orgId} />
      <SidebarInset>
        <Navbar
          start={
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <HomeButton />
              <DashboardButton />
              <Link
                to="/organization/$orgId"
                params={{ orgId }}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                )}
              >
                <ArrowLeftIcon className="size-3.5" />
                <span>Overview</span>
              </Link>
            </div>
          }
          end={
            <div className="flex items-center gap-2">
              <OrganizationSwitcher currentOrgId={orgId} />
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
