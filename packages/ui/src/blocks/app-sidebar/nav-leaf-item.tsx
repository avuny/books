"use client"

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { NavTrailing } from "./nav-badge.js"
import { getLinkA11yProps, NavLink } from "./nav-link.js"
import type {
  NavItem,
  NavLinkComponent,
  NavSize,
  PhysicalSide,
} from "./types.js"

export type NavLeafItemProps = {
  item: NavItem
  isActive: boolean
  /** Router adapter used for internal links. */
  linkComponent: NavLinkComponent
  /** Side the icon-mode tooltip opens on. */
  tooltipSide: PhysicalSide
  size?: NavSize
  onNavigate?: (item: NavItem) => void
}

/** Renders a link when `href` is set, otherwise an action button. */
export function NavLeafItem({
  item,
  isActive,
  linkComponent,
  tooltipSide,
  size = "default",
  onNavigate,
}: NavLeafItemProps) {
  const handleClick = () => {
    item.onSelect?.()
    onNavigate?.(item)
  }
  const tooltip = { children: item.label, side: tooltipSide }
  const content = (
    <>
      {item.icon}
      <span className="truncate">{item.label}</span>
      <NavTrailing shortcut={item.shortcut} badge={item.badge} />
    </>
  )

  return (
    <SidebarMenuItem>
      {item.href ? (
        <SidebarMenuButton
          render={
            <NavLink
              href={item.href}
              external={item.external}
              linkComponent={linkComponent}
              onClick={handleClick}
              {...getLinkA11yProps(item, isActive)}
            />
          }
          isActive={isActive}
          size={size}
          tooltip={tooltip}
        >
          {content}
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton
          isActive={isActive}
          size={size}
          tooltip={tooltip}
          disabled={item.disabled}
          onClick={handleClick}
        >
          {content}
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  )
}
