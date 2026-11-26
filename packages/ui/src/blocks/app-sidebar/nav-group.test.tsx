// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { SidebarProvider } from "@workspace/ui/components/sidebar"

import { NavGroup, type NavGroupProps } from "./nav-group.js"
import type { NavLinkComponent, NavSection } from "./types.js"

/** Stand-in for a router link: proves the injected component is the one rendered. */
const TestLink: NavLinkComponent = ({ href, onClick, ...props }) => (
  <a
    href={href}
    data-adapter="test"
    onClick={(event) => {
      event.preventDefault()
      onClick?.(event)
    }}
    {...props}
  />
)

const section: NavSection = {
  id: "main",
  label: "Workspace",
  items: [
    { id: "inbox", label: "Inbox", href: "/inbox", badge: { count: 120 } },
    { id: "projects", label: "Projects", href: "/projects" },
    {
      id: "settings",
      label: "Settings",
      children: [
        { id: "profile", label: "Profile", href: "/settings/profile" },
      ],
    },
  ],
}

function renderGroup(props: Partial<NavGroupProps> = {}) {
  return render(
    <SidebarProvider>
      <NavGroup
        section={section}
        isItemActive={() => false}
        linkComponent={TestLink}
        collapsed={false}
        onExpand={() => undefined}
        tooltipSide="right"
        {...props}
      />
    </SidebarProvider>
  )
}

beforeAll(() => {
  // jsdom has no matchMedia, which the shadcn sidebar provider reads.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

afterEach(cleanup)

describe("NavGroup", () => {
  it("renders the label and routes links through the injected component", () => {
    renderGroup()
    expect(screen.getByText("Workspace")).toBeTruthy()
    const link = screen.getByRole("link", { name: /^Projects/ })
    expect(link.getAttribute("href")).toBe("/projects")
    expect(link.getAttribute("data-adapter")).toBe("test")
  })

  it("marks only the active item with aria-current", () => {
    renderGroup({ isItemActive: (item) => item.id === "inbox" })
    expect(
      screen.getByRole("link", { name: /^Inbox/ }).getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen
        .getByRole("link", { name: /^Projects/ })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("caps count badges", () => {
    renderGroup()
    expect(screen.getByText("99+")).toBeTruthy()
  })

  it("reports navigation", () => {
    const onNavigate = vi.fn()
    renderGroup({ onNavigate })
    fireEvent.click(screen.getByRole("link", { name: /^Projects/ }))
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "projects" })
    )
  })

  it("opens a parent that contains the active child", () => {
    renderGroup({ isItemActive: (item) => item.id === "profile" })
    expect(
      screen
        .getByRole("button", { name: /Settings/ })
        .getAttribute("aria-expanded")
    ).toBe("true")
    expect(screen.getByRole("link", { name: "Profile" })).toBeTruthy()
  })

  it("keeps a parent closed until it is clicked", () => {
    renderGroup()
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }))
    expect(screen.getByRole("link", { name: "Profile" })).toBeTruthy()
  })

  it("asks the sidebar to expand when a parent is clicked in icon mode", () => {
    const onExpand = vi.fn()
    renderGroup({ collapsed: true, onExpand })
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })
})
