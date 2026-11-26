"use client"

import * as React from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { ChevronsUpDownIcon } from "./icons.js"
import { DefaultNavLink, NavLink } from "./nav-link.js"
import { getInitials } from "./nav-utils.js"
import type { NavItem, NavLinkComponent } from "./types.js"

export type SidebarUser = {
  name: string
  email?: string
  avatarUrl?: string
}

export type UserMenuAction = Pick<
  NavItem,
  "id" | "label" | "icon" | "href" | "external" | "onSelect" | "disabled"
> & {
  destructive?: boolean
  /** Draws a separator above this action. */
  separatorBefore?: boolean
}

export type SidebarUserMenuProps = {
  user: SidebarUser
  actions: readonly UserMenuAction[]
  /** Router adapter for `href` actions. Defaults to a plain anchor. */
  linkComponent?: NavLinkComponent
}

function UserIdentity({ user }: { user: SidebarUser }) {
  return (
    <>
      <Avatar className="size-8 rounded-lg">
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
        <AvatarFallback className="rounded-lg">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 text-start text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        {user.email ? (
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        ) : null}
      </span>
    </>
  )
}

export function SidebarUserMenu({
  user,
  actions,
  linkComponent = DefaultNavLink,
}: SidebarUserMenuProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <UserIdentity user={user} />
                <ChevronsUpDownIcon className="ms-auto" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          >
            <DropdownMenuLabel className="flex items-center gap-2 p-1 font-normal">
              <UserIdentity user={user} />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {actions.map((action) => (
              <React.Fragment key={action.id}>
                {action.separatorBefore ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  render={
                    action.href ? (
                      <NavLink
                        href={action.href}
                        external={action.external}
                        linkComponent={linkComponent}
                      />
                    ) : undefined
                  }
                  disabled={action.disabled}
                  variant={action.destructive ? "destructive" : "default"}
                  onClick={action.onSelect}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
