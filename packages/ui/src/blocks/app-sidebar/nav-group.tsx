"use client"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@workspace/ui/components/sidebar"

import { NavLeafItem } from "./nav-leaf-item.js"
import { NavParentItem } from "./nav-parent-item.js"
import { hasChildren } from "./nav-utils.js"
import type {
  NavItem,
  NavLinkComponent,
  NavSection,
  NavSize,
  PhysicalSide,
} from "./types.js"

export type NavGroupProps = {
  section: NavSection
  /** Decides which entries get the active style. Injected so the group knows nothing about routing. */
  isItemActive: (item: NavItem) => boolean
  linkComponent: NavLinkComponent
  /** True when the sidebar is icon-only. */
  collapsed: boolean
  onExpand: () => void
  tooltipSide: PhysicalSide
  size?: NavSize
  onNavigate?: (item: NavItem) => void
}

export function NavGroup({
  section,
  isItemActive,
  linkComponent,
  collapsed,
  onExpand,
  tooltipSide,
  size,
  onNavigate,
}: NavGroupProps) {
  return (
    <SidebarGroup>
      {section.label ? (
        <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {section.items.map((item) =>
            hasChildren(item) ? (
              <NavParentItem
                key={item.id}
                item={item}
                isItemActive={isItemActive}
                linkComponent={linkComponent}
                collapsed={collapsed}
                onExpand={onExpand}
                tooltipSide={tooltipSide}
                size={size}
                onNavigate={onNavigate}
              />
            ) : (
              <NavLeafItem
                key={item.id}
                item={item}
                isActive={isItemActive(item)}
                linkComponent={linkComponent}
                tooltipSide={tooltipSide}
                size={size}
                onNavigate={onNavigate}
              />
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
