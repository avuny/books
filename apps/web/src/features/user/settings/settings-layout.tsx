import type { ReactNode } from "react"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"

import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { SettingsSidebar } from "./settings-sidebar"

export type SettingsLayoutProps = {
  children: ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <SidebarProvider>
      <SettingsSidebar />
      <SidebarInset>
        <Navbar
          start={
            <>
              <SidebarTrigger className="-ml-1" />
              <HomeButton />
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
        <main className="flex-1 overflow-auto p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
