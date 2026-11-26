import type {
  CanAccess,
  Direction,
  NavBadgeData,
  NavItem,
  NavParent,
  NavSection,
  PhysicalSide,
  SidebarEdge,
} from "./types.js"

export type FlatNavItem = {
  item: NavItem
  sectionLabel?: string | undefined
  parentLabel?: string | undefined
}

/** True for items that own a non-empty `children` list. */
export function hasChildren(item: NavItem): item is NavParent {
  return item.children !== undefined && item.children.length > 0
}

function normalizePath(path: string): string {
  const end = path.search(/[?#]/)
  const clean = end === -1 ? path : path.slice(0, end)
  return clean.length > 1 && clean.endsWith("/") ? clean.slice(0, -1) : clean
}

/**
 * Prefix match by default, so `/billing` is active on `/billing/invoices`.
 * "/" and `exact` links only match the exact path. Hash-only links never match.
 */
export function isPathActive(
  href: string,
  currentPath: string,
  exact = false
): boolean {
  const target = normalizePath(href)
  if (target === "") return false
  const current = normalizePath(currentPath)
  if (exact || target === "/") return current === target
  return current === target || current.startsWith(`${target}/`)
}

/** Default active matcher. A parent is active when any of its children is. */
export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  if (hasChildren(item)) {
    return item.children.some((child) => isNavItemActive(child, currentPath))
  }
  if (!item.href || item.external) return false
  return isPathActive(item.href, currentPath, item.exact)
}

function filterNavItems(
  items: readonly NavItem[],
  canAccess: CanAccess
): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (item.permission && !canAccess(item.permission)) return []
    if (!hasChildren(item)) return [item]
    const children = filterNavItems(item.children, canAccess)
    return children.length > 0 ? [{ ...item, children }] : []
  })
}

/** Removes hidden items, parents left without children, and empty sections. */
export function filterNavSections(
  sections: readonly NavSection[],
  canAccess?: CanAccess
): NavSection[] {
  return sections.flatMap((section): NavSection[] => {
    if (canAccess && section.permission && !canAccess(section.permission))
      return []
    const items = canAccess
      ? filterNavItems(section.items, canAccess)
      : [...section.items]
    return items.length > 0 ? [{ ...section, items }] : []
  })
}

/** Actionable items only (parents are skipped). Feed this to your command palette. */
export function flattenNavItems(
  sections: readonly NavSection[]
): FlatNavItem[] {
  return sections
    .flatMap((section) =>
      section.items.flatMap((item): FlatNavItem[] =>
        hasChildren(item)
          ? item.children.map((child) => ({
              item: child,
              sectionLabel: section.label,
              parentLabel: item.label,
            }))
          : [{ item, sectionLabel: section.label }]
      )
    )
    .filter(
      ({ item }) => item.href !== undefined || item.onSelect !== undefined
    )
}

/** Text shown in a badge, or null when nothing should render. */
export function formatBadgeText(badge: NavBadgeData): string | null {
  if (badge.text) return badge.text
  if (badge.count === undefined || badge.count <= 0) return null
  const max = badge.max ?? 99
  return badge.count > max ? `${max}+` : String(badge.count)
}

/** First letter of the first `limit` words. Unicode-safe, so Arabic names work too. */
export function getInitials(name: string, limit = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase()
}

/**
 * Maps the logical edge and direction to what shadcn expects: a physical `side`,
 * plus the side tooltips open on (always away from the sidebar).
 */
export function resolveSides(
  edge: SidebarEdge,
  dir: Direction
): { side: PhysicalSide; tooltipSide: PhysicalSide } {
  const side: PhysicalSide =
    (edge === "start") === (dir === "ltr") ? "left" : "right"
  return { side, tooltipSide: side === "left" ? "right" : "left" }
}
