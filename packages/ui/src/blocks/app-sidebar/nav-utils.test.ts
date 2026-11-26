import { describe, expect, it } from "vitest"

import {
  filterNavSections,
  flattenNavItems,
  formatBadgeText,
  getInitials,
  isNavItemActive,
  isPathActive,
  resolveSides,
} from "./nav-utils.js"
import type {
  Direction,
  NavItem,
  NavSection,
  PhysicalSide,
  SidebarEdge,
} from "./types.js"

const profile: NavItem = {
  id: "profile",
  label: "Profile",
  href: "/settings/profile",
}
const members: NavItem = {
  id: "members",
  label: "Members",
  href: "/settings/members",
  permission: "members:read",
}
const settings: NavItem = {
  id: "settings",
  label: "Settings",
  children: [profile, members],
}

const sections: NavSection[] = [
  {
    id: "main",
    label: "Main",
    items: [
      { id: "home", label: "Home", href: "/" },
      {
        id: "billing",
        label: "Billing",
        href: "/billing",
        permission: "billing:read",
      },
      settings,
    ],
  },
  {
    id: "admin",
    permission: "admin",
    items: [{ id: "audit", label: "Audit", href: "/audit" }],
  },
]

const ids = (items: readonly NavItem[]): string[] =>
  items.map((item) => item.id)

describe("isPathActive", () => {
  it("matches nested paths by prefix", () => {
    expect(isPathActive("/billing", "/billing/invoices")).toBe(true)
  })

  it("does not match siblings that share a prefix", () => {
    expect(isPathActive("/bill", "/billing")).toBe(false)
  })

  it("matches the root link only on the root path", () => {
    expect(isPathActive("/", "/")).toBe(true)
    expect(isPathActive("/", "/billing")).toBe(false)
  })

  it("ignores query, hash and trailing slash", () => {
    expect(isPathActive("/billing/", "/billing?tab=plans#top")).toBe(true)
  })

  it("honours exact", () => {
    expect(isPathActive("/billing", "/billing/invoices", true)).toBe(false)
  })

  it("never matches hash-only links", () => {
    expect(isPathActive("#section", "/anything")).toBe(false)
  })
})

describe("isNavItemActive", () => {
  it("marks a parent active when one of its children is", () => {
    expect(isNavItemActive(settings, "/settings/profile")).toBe(true)
    expect(isNavItemActive(settings, "/billing")).toBe(false)
  })

  it("never marks external links active", () => {
    const docs: NavItem = {
      id: "docs",
      label: "Docs",
      href: "/docs",
      external: true,
    }
    expect(isNavItemActive(docs, "/docs")).toBe(false)
  })
})

describe("filterNavSections", () => {
  it("keeps everything when no permission checker is given", () => {
    const result = filterNavSections(sections)
    expect(result.map((section) => section.id)).toEqual(["main", "admin"])
    expect(ids(result[0]?.items ?? [])).toEqual(["home", "billing", "settings"])
  })

  it("hides items, nested items and sections the user cannot access", () => {
    const result = filterNavSections(sections, () => false)
    expect(result.map((section) => section.id)).toEqual(["main"])
    const main = result[0]?.items ?? []
    expect(ids(main)).toEqual(["home", "settings"])
    expect(ids(main[1]?.children ?? [])).toEqual(["profile"])
  })

  it("keeps what the checker allows", () => {
    const result = filterNavSections(
      sections,
      (permission) => permission === "admin"
    )
    expect(result.map((section) => section.id)).toEqual(["main", "admin"])
  })

  it("drops a parent when all of its children are hidden", () => {
    const only: NavSection[] = [
      {
        id: "s",
        items: [
          {
            id: "p",
            label: "Parent",
            children: [
              { id: "c", label: "Child", href: "/c", permission: "x" },
            ],
          },
        ],
      },
    ]
    expect(filterNavSections(only, () => false)).toEqual([])
  })

  it("drops empty sections", () => {
    expect(filterNavSections([{ id: "empty", items: [] }])).toEqual([])
  })
})

describe("flattenNavItems", () => {
  it("lists actionable items with their section and parent labels", () => {
    const flat = flattenNavItems(sections)
    expect(flat.map(({ item }) => item.id)).toEqual([
      "home",
      "billing",
      "profile",
      "members",
      "audit",
    ])
    const entry = flat.find(({ item }) => item.id === "profile")
    expect(entry?.parentLabel).toBe("Settings")
    expect(entry?.sectionLabel).toBe("Main")
  })

  it("skips items that have neither a link nor an action", () => {
    expect(
      flattenNavItems([{ id: "s", items: [{ id: "x", label: "Heading" }] }])
    ).toEqual([])
  })
})

describe("formatBadgeText", () => {
  it("prefers text over count", () => {
    expect(formatBadgeText({ text: "New", count: 3 })).toBe("New")
  })

  it("caps counts at max", () => {
    expect(formatBadgeText({ count: 120 })).toBe("99+")
    expect(formatBadgeText({ count: 12, max: 9 })).toBe("9+")
    expect(formatBadgeText({ count: 7 })).toBe("7")
  })

  it("hides empty counts", () => {
    expect(formatBadgeText({ count: 0 })).toBeNull()
    expect(formatBadgeText({})).toBeNull()
  })
})

describe("getInitials", () => {
  it("uses the first letters of the first two words", () => {
    expect(getInitials("Acme Inc Labs")).toBe("AI")
  })

  it("handles single words and blanks", () => {
    expect(getInitials("  solo ")).toBe("S")
    expect(getInitials("   ")).toBe("")
  })

  it("is unicode-safe", () => {
    expect(getInitials("أحمد علي")).toBe("أع")
  })
})

describe("resolveSides", () => {
  const cases: [SidebarEdge, Direction, PhysicalSide, PhysicalSide][] = [
    ["start", "ltr", "left", "right"],
    ["start", "rtl", "right", "left"],
    ["end", "ltr", "right", "left"],
    ["end", "rtl", "left", "right"],
  ]

  it.each(cases)(
    "edge %s in %s docks %s and opens tooltips %s",
    (edge, dir, side, tooltipSide) => {
      expect(resolveSides(edge, dir)).toEqual({ side, tooltipSide })
    }
  )
})
