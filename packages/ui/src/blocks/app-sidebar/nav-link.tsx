import type * as React from "react"

import type { NavItem, NavLinkComponent } from "./types.js"

/** Plain anchor, used when no router adapter is injected. */
export const DefaultNavLink: NavLinkComponent = (props) => <a {...props} />

export type NavLinkProps = React.ComponentProps<"a"> & {
  href: string
  /** Renders a plain anchor in a new tab and skips the router adapter. */
  external?: boolean
  /** Router adapter for internal links. */
  linkComponent?: NavLinkComponent
}

export function NavLink({
  external = false,
  linkComponent: LinkComponent = DefaultNavLink,
  ...props
}: NavLinkProps) {
  if (external)
    return <a target="_blank" rel="noopener noreferrer" {...props} />
  return <LinkComponent {...props} />
}

type LinkA11yProps = Pick<
  React.ComponentProps<"a">,
  "aria-current" | "aria-disabled" | "tabIndex"
>

/** Accessibility attributes shared by every link-style entry. */
export function getLinkA11yProps(
  item: Pick<NavItem, "disabled">,
  isActive: boolean
): LinkA11yProps {
  return {
    "aria-current": isActive ? "page" : undefined,
    "aria-disabled": item.disabled ? true : undefined,
    tabIndex: item.disabled ? -1 : undefined,
  }
}
