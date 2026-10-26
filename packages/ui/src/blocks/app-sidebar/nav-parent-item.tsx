"use client"

import * as React from "react"

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

import { ChevronRightIcon } from "./icons.js"
import { NavSubItem } from "./nav-sub-item.js"
import type {
  NavItem,
  NavLinkComponent,
  NavParent,
  NavSize,
  PhysicalSide,
} from "./types.js"

export type NavParentItemProps = {
  item: NavParent
  isItemActive: (item: NavItem) => boolean
  linkComponent: NavLinkComponent
  /** True when the sidebar is icon-only. A click then expands it instead of toggling in place. */
  collapsed: boolean
  /** Expands the sidebar out of icon-only mode. */
  onExpand: () => void
  tooltipSide: PhysicalSide
  size?: NavSize
  onNavigate?: (item: NavItem) => void
}

/** Starts open when it contains the active page. The nested list is a logical-border column. */
export function NavParentItem({
  item,
  isItemActive,
  linkComponent,
  collapsed,
  onExpand,
  tooltipSide,
  size = "default",
  onNavigate,
}: NavParentItemProps) {
  const hasActiveChild = item.children.some(isItemActive)
  const [open, setOpen] = React.useState(hasActiveChild)
  const listId = React.useId()
  const expanded = open && !collapsed

  const handleToggle = () => {
    if (collapsed) {
      onExpand()
      setOpen(true)
      return
    }
    setOpen((value) => !value)
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size={size}
        isActive={collapsed && hasActiveChild}
        tooltip={{ children: item.label, side: tooltipSide }}
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        onClick={handleToggle}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
        <ChevronRightIcon
          className={cn(
            "ms-auto transition-transform duration-200 motion-reduce:transition-none rtl:rotate-180",
            expanded && "rotate-90 rtl:rotate-90"
          )}
        />
      </SidebarMenuButton>
      {expanded ? (
        <ul
          id={listId}
          className="mx-3.5 flex min-w-0 flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5"
        >
          {item.children.map((child) => (
            <NavSubItem
              key={child.id}
              item={child}
              isActive={isItemActive(child)}
              linkComponent={linkComponent}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </SidebarMenuItem>
  )
}
