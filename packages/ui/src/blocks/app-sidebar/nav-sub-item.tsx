"use client"

import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar"

import { NavTrailing } from "./nav-badge.js"
import { getLinkA11yProps, NavLink } from "./nav-link.js"
import type { NavItem, NavLinkComponent } from "./types.js"

export type NavSubItemProps = {
  item: NavItem
  isActive: boolean
  linkComponent: NavLinkComponent
  onNavigate?: (item: NavItem) => void
}

/** One nested entry. Renders a link when `href` is set, otherwise an action button. */
export function NavSubItem({
  item,
  isActive,
  linkComponent,
  onNavigate,
}: NavSubItemProps) {
  const handleClick = () => {
    item.onSelect?.()
    onNavigate?.(item)
  }
  const content = (
    <>
      {item.icon}
      <span className="truncate">{item.label}</span>
      <NavTrailing shortcut={item.shortcut} badge={item.badge} />
    </>
  )

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        render={
          item.href ? (
            <NavLink
              href={item.href}
              external={item.external}
              linkComponent={linkComponent}
              onClick={handleClick}
              {...getLinkA11yProps(item, isActive)}
            />
          ) : (
            <button
              type="button"
              className="w-full"
              disabled={item.disabled}
              onClick={handleClick}
            />
          )
        }
        isActive={isActive}
        className="translate-x-0"
      >
        {content}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
