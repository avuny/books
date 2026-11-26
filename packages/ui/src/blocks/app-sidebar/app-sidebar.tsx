"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { NavGroup } from "./nav-group.js"
import { DefaultNavLink } from "./nav-link.js"
import {
  filterNavSections,
  isNavItemActive,
  resolveSides,
} from "./nav-utils.js"
import type {
  CanAccess,
  Direction,
  NavDensity,
  NavItem,
  NavLinkComponent,
  NavSection,
  SidebarEdge,
} from "./types.js"

export type AppSidebarProps = Omit<
  React.ComponentProps<typeof Sidebar>,
  "side" | "dir" | "children"
> & {
  /** Navigation data. Order and grouping are entirely up to the caller. */
  sections: readonly NavSection[]
  /** Current location. Used by the default active matcher only. */
  currentPath?: string
  /** Router adapter for internal links. Defaults to a plain anchor. */
  linkComponent?: NavLinkComponent
  /** Items and sections with a `permission` are hidden when this returns false. */
  canAccess?: CanAccess
  /** Replaces the default path-based active matcher. */
  isItemActive?: (item: NavItem) => boolean
  /** Fires after any item is chosen. The mobile drawer closes on its own. */
  onNavigate?: (item: NavItem) => void
  /** Same value as `<html dir>`. */
  dir?: Direction
  /** Logical edge: `start` is left in LTR and right in RTL. */
  edge?: SidebarEdge
  density?: NavDensity
  /** Accessible name of the navigation landmark. Translate it. */
  navLabel?: string
  /** Slot above the navigation: workspace switcher, search... */
  header?: React.ReactNode
  /** Slot below the navigation: user menu, usage meter... */
  footer?: React.ReactNode
}

export function AppSidebar({
  sections,
  currentPath = "",
  linkComponent = DefaultNavLink,
  canAccess,
  isItemActive,
  onNavigate,
  dir = "ltr",
  edge = "start",
  density = "comfortable",
  navLabel = "Main navigation",
  collapsible = "icon",
  header,
  footer,
  ...props
}: AppSidebarProps) {
  const { state, isMobile, setOpen, setOpenMobile } = useSidebar()
  const { side, tooltipSide } = resolveSides(edge, dir)
  const collapsed = collapsible === "icon" && state === "collapsed" && !isMobile

  const visibleSections = React.useMemo(
    () => filterNavSections(sections, canAccess),
    [sections, canAccess]
  )

  const matchActive = (item: NavItem): boolean =>
    isItemActive ? isItemActive(item) : isNavItemActive(item, currentPath)

  const handleNavigate = (item: NavItem) => {
    if (isMobile) setOpenMobile(false)
    onNavigate?.(item)
  }

  return (
    <Sidebar side={side} dir={dir} collapsible={collapsible} {...props}>
      {header ? <SidebarHeader>{header}</SidebarHeader> : null}
      <SidebarContent role="navigation" aria-label={navLabel}>
        {visibleSections.map((section) => (
          <NavGroup
            key={section.id}
            section={section}
            isItemActive={matchActive}
            linkComponent={linkComponent}
            collapsed={collapsed}
            onExpand={() => setOpen(true)}
            tooltipSide={tooltipSide}
            size={density === "compact" ? "sm" : "default"}
            onNavigate={handleNavigate}
          />
        ))}
      </SidebarContent>
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
      {collapsible === "none" ? null : <SidebarRail />}
    </Sidebar>
  )
}
