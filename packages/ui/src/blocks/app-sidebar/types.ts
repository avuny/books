import type * as React from "react"

/** Text direction of the UI. Pass the same value the app puts on `<html dir>`. */
export type Direction = "ltr" | "rtl"

/** Logical edge the sidebar docks to: left in LTR, right in RTL. */
export type SidebarEdge = "start" | "end"

/** Physical side, as required by shadcn and Radix positioning props. */
export type PhysicalSide = "left" | "right"

export type NavDensity = "comfortable" | "compact"

/** Size forwarded to the shadcn menu button. */
export type NavSize = "default" | "sm"

export type CanAccess = (permission: string) => boolean

export type NavBadgeVariant = "default" | "secondary" | "destructive"

export type NavBadgeData = {
  /** Number to show. Hidden when 0 or less. */
  count?: number
  /** Counts above this render as `max+`. Defaults to 99. */
  max?: number
  /** Free text such as "New". Wins over `count`. */
  text?: string
  /** Show a small dot instead of text. */
  dot?: boolean
  /** Screen-reader text for dot badges. */
  label?: string
  variant?: NavBadgeVariant
}

export type NavItem = {
  id: string
  label: string
  /** Any node (icon element, emoji, image). Keeps the block icon-library agnostic. */
  icon?: React.ReactNode
  href?: string
  /** Opens in a new tab and bypasses the injected link component. */
  external?: boolean
  /** Active only on an exact path match instead of a prefix match. */
  exact?: boolean
  badge?: NavBadgeData
  /** Display-only keyboard hint such as "G H". Bind the real shortcut yourself. */
  shortcut?: string
  /** Checked against `canAccess`. Items without one are always visible. */
  permission?: string
  disabled?: boolean
  /** Runs on click. Use alone for actions, or next to `href` for side effects. */
  onSelect?: () => void
  /** One level of nested items. A parent ignores its own `href`. */
  children?: readonly NavItem[]
}

export type NavParent = NavItem & { children: readonly NavItem[] }

export type NavSection = {
  id: string
  label?: string
  permission?: string
  items: readonly NavItem[]
}

export type NavLinkComponentProps = Omit<React.ComponentProps<"a">, "href"> & {
  href: string
}

/**
 * Adapter for any router's link (Next, React Router, TanStack...).
 * It must spread its props, ref included, onto the element it renders.
 */
export type NavLinkComponent = React.ComponentType<NavLinkComponentProps>
