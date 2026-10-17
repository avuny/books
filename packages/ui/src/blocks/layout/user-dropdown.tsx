"use client"

import { BadgeCheck, Bell, CreditCard, LogOut, Sparkles } from "lucide-react"
import React, { ReactNode } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"

type MenuSection = {
  enabled?: boolean
  label?: string
  onClick?: () => void
}

export type UserDropdownMenuProps = {
  dropdownMenuTrigger: React.ReactElement
  user: { name: string; identifier: string; avatar?: string }
  iconOnly?: boolean
  sections?: {
    upgrade?: MenuSection
    account?: MenuSection
    billing?: MenuSection
    notifications?: MenuSection
    logout?: MenuSection
  }
  customSections?: React.ReactNode[]
}

export function UserDropdownMenu({
  user,

  sections = {},
  customSections = [],
  dropdownMenuTrigger,
}: UserDropdownMenuProps) {
  const isMobile = useIsMobile()

  const {
    upgrade,
    account,
    billing,
    notifications,
    logout = { enabled: true }, // Default to enabled
  } = sections

  const showUpgrade = upgrade?.enabled
  const showAccount = account?.enabled
  const showBilling = billing?.enabled
  const showNotifications = notifications?.enabled
  const showLogout = logout?.enabled

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={dropdownMenuTrigger} />

      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side={isMobile ? "bottom" : "right"}
        align="end"
        sideOffset={4}
      >
        <>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="inline-flex h-10 w-10 items-center justify-center rounded-md border">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name
                    .split(" ")
                    .map((w) => w.charAt(0).toUpperCase())
                    .slice(0, 2)
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.identifier}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
        </>

        {showUpgrade && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={upgrade?.onClick}>
                <Sparkles className="mr-2 size-4" />
                {upgrade?.label || "Upgrade to Pro"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {(showAccount || showBilling || showNotifications) && (
          <>
            <DropdownMenuGroup>
              {showAccount && (
                <DropdownMenuItem onClick={account?.onClick}>
                  <BadgeCheck className="mr-2 size-4" />
                  {account?.label || "Account"}
                </DropdownMenuItem>
              )}
              {showBilling && (
                <DropdownMenuItem onClick={billing?.onClick}>
                  <CreditCard className="mr-2 size-4" />
                  {billing?.label || "Billing"}
                </DropdownMenuItem>
              )}
              {showNotifications && (
                <DropdownMenuItem onClick={notifications?.onClick}>
                  <Bell className="mr-2 size-4" />
                  {notifications?.label || "Notifications"}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {customSections.map((section, index) => (
          <React.Fragment key={index}>
            {section}
            <DropdownMenuSeparator />
          </React.Fragment>
        ))}

        {showLogout && (
          <DropdownMenuItem onClick={logout?.onClick}>
            <LogOut className="mr-2 size-4" />
            {logout?.label || "Log out"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
