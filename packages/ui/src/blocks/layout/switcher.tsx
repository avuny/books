"use client"

import * as React from "react"
import { ChevronsUpDown, Plus } from "lucide-react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
import { DropdownMenuShortcut } from "@workspace/ui/components/dropdown-menu"

import { renderLogo } from "@workspace/ui/blocks/layout/render-logo"

// Reusable & Context-Agnostic Switcher
type SwitcherItem = {
  name: string
  id: string
  logo?: React.ElementType
  description?: string | null
}
export function Switcher({
  items,
  addTitle = "Add",
  switcherTitle = "Options",
  onAddClick,
  onItemSelect,
  initialSelectedItem,
}: {
  onItemSelect?: (id: string) => void
  initialSelectedItem?: SwitcherItem
  items: SwitcherItem[]
  addTitle?: string
  switcherTitle?: string
  onAddClick?: () => void
}) {
  const { isMobile } = useSidebar()
  const [selectedItem, setSelectedItem] = React.useState(
    initialSelectedItem || items[0]
  )

  if (!selectedItem) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={() => (
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {renderLogo(selectedItem.logo, selectedItem.name)}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {selectedItem.name}
                  </span>
                  <span className="truncate text-xs">
                    {selectedItem.description}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            )}
          ></DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {switcherTitle && (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {switcherTitle}
              </DropdownMenuLabel>
            )}
            {items.map((item, index) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                  onItemSelect?.(item.id)
                  setSelectedItem(item)
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  {renderLogo(item.logo, item.name)}
                </div>
                {item.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            {onAddClick && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={onAddClick}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">
                    {addTitle}
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
